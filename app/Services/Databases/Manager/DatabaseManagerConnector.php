<?php

namespace Raptor\Services\Databases\Manager;

use Raptor\Models\Database;
use Illuminate\Support\Facades\Cache;
use Raptor\Exceptions\DisplayException;
use Illuminate\Database\DatabaseManager;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Extensions\DynamicDatabaseConnection;
use Raptor\Repositories\Eloquent\DatabaseRepository;

/**
 * Opens connections for the Raptor DB Manager. The connection always uses the credentials of the
 * server database itself, so a user can never see more than the database user is allowed to.
 */
class DatabaseManagerConnector
{
    /** MySQL error raised when the credentials or the client host are not accepted. */
    private const ACCESS_DENIED = 1045;

    public function __construct(
        private DatabaseManager $databases,
        private DynamicDatabaseConnection $dynamic,
        private Encrypter $encrypter,
    ) {
    }

    /**
     * Connects to the database, granting the panel access first when the database user only
     * accepts connections from somewhere else.
     *
     * @throws DisplayException
     */
    public function connect(Database $database, bool $buffered = true): \PDO
    {
        try {
            return $this->open($database, $buffered);
        } catch (\PDOException $exception) {
            if ((int) ($exception->errorInfo[1] ?? 0) !== self::ACCESS_DENIED) {
                throw $this->unreachable($exception);
            }
        }

        try {
            $this->grantPanelAccess($database);

            return $this->open($database, $buffered);
        } catch (\PDOException $exception) {
            throw $this->unreachable($exception);
        }
    }

    /**
     * Removes the account created by grantPanelAccess, used when a database is deleted.
     */
    public function revokePanelAccess(Database $database): void
    {
        $host = Cache::pull($this->cacheKey($database));
        if (!is_string($host) || $host === $database->remote) {
            return;
        }

        try {
            $this->admin($database)->statement(sprintf('DROP USER IF EXISTS %s@%s', $this->quote($database->username), $this->quote($host)));
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function open(Database $database, bool $buffered): \PDO
    {
        $host = $database->host;

        $pdo = new \PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host->host, $host->port, $database->database),
            $database->username,
            $this->encrypter->decrypt($database->password),
            [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_TIMEOUT => 5,
                \PDO::ATTR_EMULATE_PREPARES => false,
                \PDO::ATTR_STRINGIFY_FETCHES => false,
                \PDO::MYSQL_ATTR_LOCAL_INFILE => false,
                \PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
                \PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => $buffered,
            ]
        );

        // Stops runaway queries, MySQL counts milliseconds and MariaDB seconds.
        $timeout = (int) config('raptor.db_manager.query_timeout', 30);
        foreach (['SET SESSION max_execution_time = %d', 'SET SESSION max_statement_time = %d'] as $i => $statement) {
            try {
                $pdo->exec(sprintf($statement, $i === 0 ? $timeout * 1000 : $timeout));
            } catch (\PDOException) {
                // Not supported by this server flavour.
            }
        }

        return $pdo;
    }

    /**
     * Creates the database user for the host the panel connects from, with the same password and
     * the same privileges the user already has from its own remote.
     */
    private function grantPanelAccess(Database $database): void
    {
        $admin = $this->admin($database);
        $host = $this->panelHost($admin);
        if ($host === null) {
            return;
        }

        $user = sprintf('%s@%s', $this->quote($database->username), $this->quote($host));
        $password = str_replace(['\\', "'"], ['\\\\', "\\'"], $this->encrypter->decrypt($database->password));

        $admin->statement(sprintf("CREATE USER IF NOT EXISTS %s IDENTIFIED BY '%s'", $user, $password));
        $admin->statement(sprintf("ALTER USER %s IDENTIFIED BY '%s'", $user, $password));
        $admin->statement(sprintf(
            'GRANT %s ON %s.* TO %s',
            DatabaseRepository::PRIVILEGES,
            DatabaseRepository::grantTarget($database->database),
            $user
        ));
        $admin->statement('FLUSH PRIVILEGES');

        Cache::forever($this->cacheKey($database), $host);
    }

    private function cacheKey(Database $database): string
    {
        return 'db_manager:panel_host:' . $database->id;
    }

    private function admin(Database $database): \Illuminate\Database\Connection
    {
        $this->dynamic->set('db_manager', $database->database_host_id);
        $this->databases->purge('db_manager');

        return $this->databases->connection('db_manager');
    }

    /**
     * The host name the database server sees the panel connecting from.
     */
    private function panelHost(\Illuminate\Database\Connection $admin): ?string
    {
        $user = (string) ($admin->selectOne('SELECT USER() AS user')->user ?? '');
        $host = substr($user, strrpos($user, '@') + 1);

        return $host === '' || !preg_match('/^[\w\-.:%]+$/', $host) ? null : $host;
    }

    private function quote(string $value): string
    {
        return '`' . str_replace('`', '``', $value) . '`';
    }

    private function unreachable(\PDOException $exception): DisplayException
    {
        report($exception);

        return new DisplayException(__('Could not connect to the database: :reason', [
            'reason' => $exception->errorInfo[2] ?? $exception->getMessage(),
        ]));
    }
}
