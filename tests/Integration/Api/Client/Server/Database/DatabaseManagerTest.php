<?php

namespace Raptor\Tests\Integration\Api\Client\Server\Database;

use PDO;
use Raptor\Models\Server;
use Raptor\Models\Subuser;
use Raptor\Models\Database;
use Raptor\Models\Permission;
use Raptor\Models\DatabaseHost;
use Illuminate\Http\UploadedFile;
use Raptor\Contracts\Extensions\HashidsInterface;
use Raptor\Services\Databases\Manager\SqlSplitter;
use Raptor\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;

/**
 * Runs the Raptor DB Manager against a real schema on the test database server.
 */
class DatabaseManagerTest extends ClientApiIntegrationTestCase
{
    private const SCHEMA = 'e2e';

    private PDO $pdo;

    public function setUp(): void
    {
        parent::setUp();

        try {
            $this->pdo = new PDO(
                sprintf('mysql:host=%s;port=%s;dbname=%s', env('DB_HOST', '127.0.0.1'), env('DB_PORT', 3306), self::SCHEMA),
                env('DB_USERNAME'),
                env('DB_PASSWORD'),
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
        } catch (\PDOException) {
            $this->markTestSkipped('The schema ' . self::SCHEMA . ' is not available for the DB Manager tests.');
        }

        $this->pdo->exec('DROP TABLE IF EXISTS dbm_players, dbm_log');
        $this->pdo->exec('CREATE TABLE dbm_players (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(64) NOT NULL, score INT NULL, note TEXT NULL)');
        $this->pdo->exec('CREATE TABLE dbm_log (message VARCHAR(64) NULL, level INT NULL)');
        $this->pdo->exec("INSERT INTO dbm_players (name, score) VALUES ('alice', 10), ('bob', 20), ('carol', 30)");
        $this->pdo->exec("INSERT INTO dbm_log VALUES ('one', 1), ('two', 2), ('one', 1)");
    }

    public function tearDown(): void
    {
        if (isset($this->pdo)) {
            $this->pdo->exec('DROP TABLE IF EXISTS dbm_players, dbm_log, dbm_new');
        }

        parent::tearDown();
    }

    private function database(Server $server): Database
    {
        $host = DatabaseHost::factory()->create([
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', 3306),
            'username' => env('DB_USERNAME'),
            'password' => encrypt(env('DB_PASSWORD')),
        ]);

        return Database::factory()->create([
            'server_id' => $server->id,
            'database_host_id' => $host->id,
            'database' => self::SCHEMA,
            'username' => env('DB_USERNAME'),
            'remote' => '%',
            'password' => encrypt(env('DB_PASSWORD')),
        ]);
    }

    private function url(Server $server, Database $database, string $path = ''): string
    {
        return $this->link($server, '/databases/' . $this->app->make(HashidsInterface::class)->encode($database->id) . '/manager' . $path);
    }

    public function testTablesStructureAndRowsCanBeBrowsed(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $database = $this->database($server);

        $this->actingAs($user)->getJson($this->url($server, $database))
            ->assertOk()
            ->assertJsonPath('name', self::SCHEMA)
            ->assertJsonFragment(['name' => 'dbm_players', 'view' => false]);

        $this->getJson($this->url($server, $database, '/tables/dbm_players'))
            ->assertOk()
            ->assertJsonPath('primary', ['id'])
            ->assertJsonPath('columns.0.auto_increment', true)
            ->assertJsonPath('columns.1.nullable', false);

        $this->getJson($this->url($server, $database, '/tables/dbm_players/rows?sort=score&direction=desc&per_page=2'))
            ->assertOk()
            ->assertJsonPath('pagination.total', 3)
            ->assertJsonPath('pagination.total_pages', 2)
            ->assertJsonPath('rows.0.1', 'carol');

        $this->getJson($this->url($server, $database, '/tables/dbm_players/rows?search=bo'))
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('rows.0.1', 'bob');

        $this->getJson($this->url($server, $database, '/tables/dbm_players/rows?' . http_build_query(['filters' => [['column' => 'score', 'operator' => '>=', 'value' => '20']]])))
            ->assertOk()
            ->assertJsonPath('pagination.total', 2);

        $this->getJson($this->url($server, $database, '/tables/missing'))->assertStatus(400);
        $this->getJson($this->url($server, $database, '/tables/' . rawurlencode('dbm_players`; DROP TABLE dbm_log; --')))->assertStatus(400);
        $this->assertSame(3, (int) $this->pdo->query('SELECT COUNT(*) FROM dbm_log')->fetchColumn());
    }

    public function testRowsCanBeInsertedUpdatedAndDeleted(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $database = $this->database($server);

        $this->actingAs($user)->postJson($this->url($server, $database, '/tables/dbm_players/rows'), [
            'values' => ['name' => 'dave', 'score' => 40, 'not_a_column' => 'x'],
        ])->assertCreated()->assertJsonPath('id', 4);

        $this->patchJson($this->url($server, $database, '/tables/dbm_players/rows'), [
            'key' => ['id' => 2],
            'values' => ['score' => null, 'note' => "it's"],
        ])->assertOk()->assertJsonPath('affected', 1);

        $this->assertSame([null, "it's"], $this->pdo->query('SELECT score, note FROM dbm_players WHERE id = 2')->fetch(PDO::FETCH_NUM));

        $this->postJson($this->url($server, $database, '/tables/dbm_players/rows/delete'), [
            'keys' => [['id' => 1], ['id' => 4]],
        ])->assertOk()->assertJsonPath('deleted', 2);

        // A table without primary key identifies rows by every value and changes only one of the duplicates.
        $this->patchJson($this->url($server, $database, '/tables/dbm_log/rows'), [
            'key' => ['message' => 'one', 'level' => 1],
            'values' => ['level' => 5],
        ])->assertOk()->assertJsonPath('affected', 1);
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM dbm_log WHERE level = 5')->fetchColumn());

        $this->patchJson($this->url($server, $database, '/tables/dbm_log/rows'), [
            'key' => ['message' => 'one'],
            'values' => ['level' => 5],
        ])->assertStatus(400);

        $this->assertDatabaseHas('activity_logs', ['event' => 'server:database.manager.update', 'actor_id' => $user->id]);
    }

    public function testTheSqlConsoleRunsStatementsAndStopsAtTheFirstError(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $database = $this->database($server);

        $this->actingAs($user)->postJson($this->url($server, $database, '/query'), [
            'sql' => "SELECT name FROM dbm_players WHERE name <> 'a;b' ORDER BY id; UPDATE dbm_players SET score = 0 WHERE id = 1; SELECT * FROM nope; SELECT 1",
        ])
            ->assertOk()
            ->assertJsonCount(3, 'results')
            ->assertJsonPath('results.0.columns.0.name', 'name')
            ->assertJsonPath('results.0.rows', [['alice'], ['bob'], ['carol']])
            ->assertJsonPath('results.1.affected', 1)
            ->assertJsonPath('results.2.code', 1146);

        // The console runs with the credentials of the database user, other schemas stay out of reach.
        $this->postJson($this->url($server, $database, '/query'), ['sql' => 'SELECT * FROM mysql.user'])
            ->assertOk()
            ->assertJsonStructure(['results' => [['error']]]);
    }

    public function testExportAndImportRoundTrip(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $database = $this->database($server);

        $dump = $this->actingAs($user)->get($this->url($server, $database, '/export?' . http_build_query(['tables' => ['dbm_players']])))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/sql; charset=utf-8')
            ->streamedContent();

        $this->assertStringContainsString('CREATE TABLE `dbm_players`', $dump);
        $this->assertStringContainsString("'carol'", $dump);
        $this->assertStringNotContainsString('dbm_log', $dump);

        $this->pdo->exec('DROP TABLE dbm_players');

        $this->post($this->url($server, $database, '/import'), [
            'file' => UploadedFile::fake()->createWithContent('backup.sql', $dump),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('error', null);

        $this->assertSame(3, (int) $this->pdo->query('SELECT COUNT(*) FROM dbm_players')->fetchColumn());

        $this->post($this->url($server, $database, '/import'), [
            'file' => UploadedFile::fake()->createWithContent('backup.sql', "CREATE TABLE dbm_new (id INT);\nINSERT INTO nope VALUES (1);"),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('executed', 1)->assertJsonPath('statement', 'INSERT INTO nope VALUES (1)');
    }

    public function testTablesCanBeEmptiedAndDropped(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $database = $this->database($server);

        $this->actingAs($user)->postJson($this->url($server, $database, '/tables/dbm_log/truncate'))->assertNoContent();
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM dbm_log')->fetchColumn());

        $this->deleteJson($this->url($server, $database, '/tables/dbm_log'))->assertNoContent();
        $this->assertFalse($this->pdo->query("SHOW TABLES LIKE 'dbm_log'")->fetchColumn());
    }

    public function testTheManagerPermissionIsRequired(): void
    {
        [$user, $server] = $this->generateTestAccount([Permission::ACTION_DATABASE_READ]);
        $database = $this->database($server);

        $this->actingAs($user)->getJson($this->url($server, $database))->assertForbidden();
        $this->postJson($this->url($server, $database, '/query'), ['sql' => 'DROP TABLE dbm_log'])->assertForbidden();

        Subuser::query()->where('user_id', $user->id)->update(['permissions' => [Permission::ACTION_DATABASE_MANAGE]]);
        $this->getJson($this->url($server, $database))->assertOk();
    }

    public function testTheSplitterHandlesQuotesCommentsAndDelimiters(): void
    {
        $sql = "-- comment\nSELECT 'a;b', \"c;\" FROM `t;x`; # other\n/*!40101 SET NAMES utf8 */;\n/* x; */ INSERT INTO t VALUES ('it''s', 'x\\'y;');\n"
            . "DELIMITER //\nCREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END//\nDELIMITER ;\nSELECT 3";

        $this->assertSame([
            "SELECT 'a;b', \"c;\" FROM `t;x`",
            '/*!40101 SET NAMES utf8 */',
            "INSERT INTO t VALUES ('it''s', 'x\\'y;')",
            'CREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END',
            'SELECT 3',
        ], iterator_to_array(SqlSplitter::split($sql), false));
    }

}
