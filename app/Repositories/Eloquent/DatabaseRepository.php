<?php

namespace Raptor\Repositories\Eloquent;

use Raptor\Models\Database;
use Illuminate\Support\Collection;
use Illuminate\Foundation\Application;
use Illuminate\Database\DatabaseManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Raptor\Contracts\Repository\DatabaseRepositoryInterface;

class DatabaseRepository extends EloquentRepository implements DatabaseRepositoryInterface
{
    protected string $connection = self::DEFAULT_CONNECTION_NAME;

    /**
     * DatabaseRepository constructor.
     */
    public const PRIVILEGES = 'SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, REFERENCES, INDEX, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, CREATE TEMPORARY TABLES, CREATE VIEW, SHOW VIEW, EVENT, TRIGGER';

    public function __construct(Application $application, private DatabaseManager $database)
    {
        parent::__construct($application);
    }

    /**
     * Return the model backing this repository.
     */
    public function model(): string
    {
        return Database::class;
    }

    /**
     * Return the connection to execute statements against.
     */
    public function getConnection(): string
    {
        return $this->connection;
    }

    /**
     * Set the connection name to execute statements against.
     */
    public function setConnection(string $connection): self
    {
        $this->connection = $connection;

        return $this;
    }

    /**
     * Return all the databases belonging to a server.
     */
    public function getDatabasesForServer(int $server): Collection
    {
        return $this->getBuilder()->with('host')->where('server_id', $server)->get($this->getColumns());
    }

    /**
     * Return all the databases for a given host with the server relationship loaded.
     */
    public function getDatabasesForHost(int $host, int $count = 25): LengthAwarePaginator
    {
        return $this->getBuilder()->with('server')
            ->where('database_host_id', $host)
            ->paginate($count, $this->getColumns());
    }

    /**
     * Create a new database on a given connection.
     */
    public function createDatabase(string $database): bool
    {
        return $this->run(sprintf('CREATE DATABASE IF NOT EXISTS `%s`', $database));
    }

    /**
     * Create a new database user on a given connection.
     */
    public function createUser(string $username, string $remote, string $password, ?int $max_connections): bool
    {
        $args = [$username, $remote, $password];
        $command = 'CREATE USER `%s`@`%s` IDENTIFIED BY \'%s\'';

        if (!empty($max_connections)) {
            $args[] = $max_connections;
            $command .= ' WITH MAX_USER_CONNECTIONS %s';
        }

        return $this->run(sprintf($command, ...$args));
    }

    /**
     * Give a specific user access to a given database.
     */
    public function assignUserToDatabase(string $database, string $username, string $remote): bool
    {
        return $this->run(sprintf(
            'GRANT %s ON %s.* TO `%s`@`%s`',
            self::PRIVILEGES,
            self::grantTarget($database),
            $username,
            $remote
        ));
    }

    /**
     * Removes a grant made before database names were escaped, see grantTarget(). Returns
     * false when there was no such grant.
     */
    public function revokeUnescapedGrant(string $database, string $username, string $remote): bool
    {
        try {
            return $this->run(sprintf('REVOKE ALL PRIVILEGES ON `%s`.* FROM `%s`@`%s`', str_replace('`', '``', $database), $username, $remote));
        } catch (\Illuminate\Database\QueryException $exception) {
            // 1141: there is no such grant, 1147: there is no such grant on the table level.
            if (in_array((int) ($exception->errorInfo[1] ?? 0), [1141, 1147], true)) {
                return false;
            }

            throw $exception;
        }
    }

    /**
     * The database name as it must appear in a GRANT. MySQL reads "_" and "%" in that
     * position as wildcards, so without escaping a grant on "s1__shop" would also cover the
     * database "s11_shop" of another server.
     */
    public static function grantTarget(string $database): string
    {
        return '`' . str_replace(['`', '\\', '_', '%'], ['``', '\\\\', '\\_', '\\%'], $database) . '`';
    }

    /**
     * Flush the privileges for a given connection.
     */
    public function flush(): bool
    {
        return $this->run('FLUSH PRIVILEGES');
    }

    /**
     * Drop a given database on a specific connection.
     */
    public function dropDatabase(string $database): bool
    {
        return $this->run(sprintf('DROP DATABASE IF EXISTS `%s`', $database));
    }

    /**
     * Drop a given user on a specific connection.
     */
    public function dropUser(string $username, string $remote): bool
    {
        return $this->run(sprintf('DROP USER IF EXISTS `%s`@`%s`', $username, $remote));
    }

    /**
     * Run the provided statement against the database on a given connection.
     */
    private function run(string $statement): bool
    {
        return $this->database->connection($this->getConnection())->statement($statement);
    }
}
