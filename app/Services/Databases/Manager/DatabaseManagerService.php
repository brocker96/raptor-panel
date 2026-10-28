<?php

namespace Raptor\Services\Databases\Manager;

use PDO;
use PDOException;
use PDOStatement;
use Raptor\Models\Database;
use Raptor\Exceptions\DisplayException;

/**
 * The engine behind the Raptor DB Manager: browsing tables, editing rows, running SQL and
 * exporting or importing dumps of a single server database.
 */
class DatabaseManagerService
{
    /** Longest string value sent to the browser, longer values are cut and marked as truncated. */
    public const MAX_CELL = 20000;

    private array $pdo = [];

    public function __construct(private DatabaseManagerConnector $connector)
    {
    }

    public function connection(Database $database): PDO
    {
        return $this->pdo[$database->id] ??= $this->connector->connect($database);
    }

    /**
     * Overview of the database: server version, size and every table and view.
     */
    public function overview(Database $database): array
    {
        $pdo = $this->connection($database);

        $tables = $pdo->query(
            'SELECT TABLE_NAME AS name, TABLE_TYPE AS type, ENGINE AS engine, TABLE_ROWS AS `rows`,
                DATA_LENGTH AS data, INDEX_LENGTH AS `index`, TABLE_COLLATION AS collation,
                TABLE_COMMENT AS comment, UPDATE_TIME AS updated
            FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'
        )->fetchAll(PDO::FETCH_ASSOC);

        return [
            'name' => $database->database,
            'version' => $pdo->query('SELECT VERSION()')->fetchColumn(),
            'charset' => $pdo->query('SELECT @@character_set_database')->fetchColumn(),
            'collation' => $pdo->query('SELECT @@collation_database')->fetchColumn(),
            'size' => array_sum(array_map(fn ($t) => (int) $t['data'] + (int) $t['index'], $tables)),
            'tables' => array_map(fn ($t) => [
                'name' => $t['name'],
                'view' => $t['type'] === 'VIEW',
                'engine' => $t['engine'],
                'rows' => $t['rows'] === null ? null : (int) $t['rows'],
                'size' => (int) $t['data'] + (int) $t['index'],
                'collation' => $t['collation'],
                'comment' => $t['comment'],
                'updated_at' => $t['updated'],
            ], $tables),
        ];
    }

    /**
     * Columns, indexes, foreign keys and the CREATE statement of a table.
     */
    public function structure(Database $database, string $table): array
    {
        $pdo = $this->connection($database);
        $this->assertTable($database, $table);

        $columns = $this->prepare($pdo,
            'SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, DATA_TYPE AS data_type, IS_NULLABLE AS nullable,
                COLUMN_DEFAULT AS `default`, COLUMN_KEY AS `key`, EXTRA AS extra, COLUMN_COMMENT AS comment,
                CHARACTER_MAXIMUM_LENGTH AS length
            FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
            [$table]
        )->fetchAll(PDO::FETCH_ASSOC);

        $indexes = [];
        foreach ($this->prepare($pdo,
            'SELECT INDEX_NAME AS name, NON_UNIQUE AS non_unique, COLUMN_NAME AS col, INDEX_TYPE AS type
            FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX',
            [$table]
        )->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $indexes[$row['name']] ??= [
                'name' => $row['name'],
                'unique' => !(int) $row['non_unique'],
                'primary' => $row['name'] === 'PRIMARY',
                'type' => $row['type'],
                'columns' => [],
            ];
            $indexes[$row['name']]['columns'][] = $row['col'];
        }

        $foreign = $this->prepare($pdo,
            'SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
            [$table]
        )->fetchAll(PDO::FETCH_ASSOC);

        $create = $pdo->query('SHOW CREATE TABLE ' . $this->ident($table))->fetch(PDO::FETCH_NUM);

        return [
            'name' => $table,
            'columns' => array_map(fn ($c) => [
                'name' => $c['name'],
                'type' => $c['type'],
                'data_type' => strtolower($c['data_type']),
                'nullable' => $c['nullable'] === 'YES',
                'default' => $c['default'],
                'key' => $c['key'],
                'extra' => $c['extra'],
                'comment' => $c['comment'],
                'auto_increment' => str_contains(strtolower($c['extra']), 'auto_increment'),
                'binary' => $this->isBinary($c['data_type']),
            ], $columns),
            'primary' => $indexes['PRIMARY']['columns'] ?? [],
            'indexes' => array_values($indexes),
            'foreign_keys' => array_map(fn ($f) => [
                'name' => $f['name'],
                'column' => $f['col'],
                'table' => $f['ref_table'],
                'references' => $f['ref_column'],
            ], $foreign),
            'create' => $create[1] ?? '',
        ];
    }

    /**
     * A page of rows, optionally sorted, searched across every column or filtered by one column.
     */
    public function rows(Database $database, string $table, array $options): array
    {
        $pdo = $this->connection($database);
        $structure = $this->structure($database, $table);
        $columns = array_column($structure['columns'], 'name');

        $perPage = min(max((int) ($options['per_page'] ?? 50), 1), 500);
        $page = max((int) ($options['page'] ?? 1), 1);

        [$where, $bindings] = $this->filters($structure, $options);

        $sql = 'SELECT * FROM ' . $this->ident($table) . $where;
        if (!empty($options['sort']) && in_array($options['sort'], $columns, true)) {
            $sql .= ' ORDER BY ' . $this->ident($options['sort']) . (($options['direction'] ?? 'asc') === 'desc' ? ' DESC' : ' ASC');
        }
        $sql .= sprintf(' LIMIT %d OFFSET %d', $perPage, ($page - 1) * $perPage);

        $statement = $this->prepare($pdo, $sql, $bindings);
        [$rows, $truncated] = $this->fetchRows($statement, $structure['columns']);

        $total = (int) $this->prepare($pdo, 'SELECT COUNT(*) FROM ' . $this->ident($table) . $where, $bindings)->fetchColumn();

        return [
            'columns' => $structure['columns'],
            'primary' => $structure['primary'],
            'rows' => $rows,
            'truncated' => $truncated,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'total_pages' => max((int) ceil($total / $perPage), 1),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $values
     */
    public function insert(Database $database, string $table, array $values): int
    {
        $pdo = $this->connection($database);
        $values = $this->onlyColumns($database, $table, $values);
        if (empty($values)) {
            $pdo->exec('INSERT INTO ' . $this->ident($table) . ' () VALUES ()');
        } else {
            $this->prepare(
                $pdo,
                sprintf(
                    'INSERT INTO %s (%s) VALUES (%s)',
                    $this->ident($table),
                    implode(', ', array_map(fn ($c) => $this->ident($c), array_keys($values))),
                    implode(', ', array_fill(0, count($values), '?'))
                ),
                array_values($values)
            );
        }

        return (int) $pdo->lastInsertId();
    }

    /**
     * Updates the single row identified by $key, which holds the original values of the primary
     * key, or of every column when the table has none.
     */
    public function update(Database $database, string $table, array $key, array $values): int
    {
        $pdo = $this->connection($database);
        $values = $this->onlyColumns($database, $table, $values);
        if (empty($values)) {
            return 0;
        }

        [$where, $bindings] = $this->identify($database, $table, $key);

        return $this->prepare(
            $pdo,
            sprintf(
                'UPDATE %s SET %s%s LIMIT 1',
                $this->ident($table),
                implode(', ', array_map(fn ($c) => $this->ident($c) . ' = ?', array_keys($values))),
                $where
            ),
            [...array_values($values), ...$bindings]
        )->rowCount();
    }

    /**
     * @param array<int, array<string, mixed>> $keys
     */
    public function delete(Database $database, string $table, array $keys): int
    {
        $pdo = $this->connection($database);
        $deleted = 0;

        $pdo->beginTransaction();
        try {
            foreach ($keys as $key) {
                [$where, $bindings] = $this->identify($database, $table, $key);
                $deleted += $this->prepare($pdo, 'DELETE FROM ' . $this->ident($table) . $where . ' LIMIT 1', $bindings)->rowCount();
            }
            $pdo->commit();
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }

        return $deleted;
    }

    public function truncate(Database $database, string $table): void
    {
        $this->assertTable($database, $table);
        $this->connection($database)->exec('TRUNCATE TABLE ' . $this->ident($table));
    }

    public function drop(Database $database, string $table): void
    {
        $view = collect($this->overview($database)['tables'])->firstWhere('name', $table)['view'] ?? false;
        $this->assertTable($database, $table);
        $this->connection($database)->exec(($view ? 'DROP VIEW ' : 'DROP TABLE ') . $this->ident($table));
    }

    /**
     * Runs one or more SQL statements and returns the result of each of them. Execution stops at
     * the first failing statement, whose error is returned with the results before it.
     */
    public function query(Database $database, string $sql): array
    {
        $pdo = $this->connection($database);
        $limit = (int) config('raptor.db_manager.max_result_rows', 1000);
        $maxStatements = (int) config('raptor.db_manager.max_statements', 50);
        $results = [];

        foreach (SqlSplitter::split($sql) as $index => $statement) {
            if ($index >= $maxStatements) {
                $results[] = ['sql' => $statement, 'error' => __('Only :count statements can be run at once.', ['count' => $maxStatements])];
                break;
            }

            $started = microtime(true);
            try {
                $result = $pdo->query($statement);
                $time = round((microtime(true) - $started) * 1000, 2);

                if ($result->columnCount() === 0) {
                    $results[] = ['sql' => $statement, 'time' => $time, 'affected' => $result->rowCount()];
                    continue;
                }

                $columns = [];
                for ($i = 0; $i < $result->columnCount(); ++$i) {
                    $meta = $result->getColumnMeta($i) ?: [];
                    $columns[] = [
                        'name' => $meta['name'] ?? "column_$i",
                        'table' => $meta['table'] ?? null,
                        'type' => strtolower($meta['native_type'] ?? ''),
                        'binary' => in_array('blob', $meta['flags'] ?? [], true) && ($meta['native_type'] ?? '') === 'BLOB' && ($meta['mysql:decl_type'] ?? '') !== 'TEXT',
                    ];
                }

                $rows = [];
                $more = false;
                while (($row = $result->fetch(PDO::FETCH_NUM)) !== false) {
                    if (count($rows) >= $limit) {
                        $more = true;
                        continue;
                    }
                    $rows[] = array_map(fn ($v) => $this->cell($v)[0], $row);
                }
                $result->closeCursor();

                $results[] = [
                    'sql' => $statement,
                    'time' => $time,
                    'columns' => $columns,
                    'rows' => $rows,
                    'limited' => $more,
                ];
            } catch (PDOException $exception) {
                $results[] = [
                    'sql' => $statement,
                    'error' => $exception->errorInfo[2] ?? $exception->getMessage(),
                    'code' => $exception->errorInfo[1] ?? null,
                ];
                break;
            }
        }

        return $results;
    }

    /**
     * Runs a whole SQL file, returning how many statements succeeded and the first error.
     *
     * @param resource $stream
     */
    public function import(Database $database, $stream): array
    {
        $pdo = $this->connection($database);
        $executed = 0;
        $started = microtime(true);

        foreach (SqlSplitter::split(stream_get_contents($stream)) as $statement) {
            try {
                $pdo->exec($statement);
                ++$executed;
            } catch (PDOException $exception) {
                return [
                    'executed' => $executed,
                    'time' => round(microtime(true) - $started, 2),
                    'error' => $exception->errorInfo[2] ?? $exception->getMessage(),
                    'statement' => mb_strimwidth($statement, 0, 500, '…'),
                ];
            }
        }

        return ['executed' => $executed, 'time' => round(microtime(true) - $started, 2), 'error' => null];
    }

    /**
     * Writes a SQL dump of the given tables (all when empty) to the output callback.
     *
     * @param callable(string): void $write
     */
    public function export(Database $database, array $tables, bool $data, callable $write): void
    {
        $pdo = $this->connector->connect($database, false);
        $all = array_column($this->overview($database)['tables'], 'view', 'name');
        $tables = empty($tables) ? array_keys($all) : array_values(array_intersect(array_keys($all), $tables));

        // Tables first, views last since they can depend on tables.
        usort($tables, fn ($a, $b) => (int) $all[$a] <=> (int) $all[$b]);

        $write(sprintf(
            "-- Raptor DB Manager SQL dump\n-- Database: %s\n-- Generated: %s\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n",
            $database->database,
            now()->toDateTimeString()
        ));

        foreach ($tables as $table) {
            $create = $pdo->query('SHOW CREATE TABLE ' . $this->ident($table))->fetch(PDO::FETCH_NUM)[1];

            if ($all[$table]) {
                $write(sprintf("DROP VIEW IF EXISTS %s;\n%s;\n\n", $this->ident($table), $create));
                continue;
            }

            $write(sprintf("-- Table %s\nDROP TABLE IF EXISTS %s;\n%s;\n\n", $table, $this->ident($table), $create));
            if (!$data) {
                continue;
            }

            $result = $pdo->query('SELECT * FROM ' . $this->ident($table));
            $batch = [];
            $columns = null;
            while (($row = $result->fetch(PDO::FETCH_ASSOC)) !== false) {
                $columns ??= implode(', ', array_map(fn ($c) => $this->ident($c), array_keys($row)));
                $batch[] = '(' . implode(', ', array_map(fn ($v) => $this->literal($pdo, $v), $row)) . ')';
                if (count($batch) >= 200) {
                    $write(sprintf("INSERT INTO %s (%s) VALUES\n%s;\n", $this->ident($table), $columns, implode(",\n", $batch)));
                    $batch = [];
                }
            }
            if ($batch) {
                $write(sprintf("INSERT INTO %s (%s) VALUES\n%s;\n", $this->ident($table), $columns, implode(",\n", $batch)));
            }
            $result->closeCursor();
            $write("\n");
        }

        $write("SET FOREIGN_KEY_CHECKS = 1;\n");
    }

    private function filters(array $structure, array $options): array
    {
        $clauses = [];
        $bindings = [];
        $columns = array_column($structure['columns'], null, 'name');

        $search = trim((string) ($options['search'] ?? ''));
        if ($search !== '') {
            $like = [];
            foreach ($columns as $name => $column) {
                if ($column['binary']) {
                    continue;
                }
                $like[] = 'CAST(' . $this->ident($name) . ' AS CHAR) LIKE ?';
                $bindings[] = '%' . addcslashes($search, '%_\\') . '%';
            }
            if ($like) {
                $clauses[] = '(' . implode(' OR ', $like) . ')';
            }
        }

        $operators = ['=' => '=', '!=' => '<>', '>' => '>', '<' => '<', '>=' => '>=', '<=' => '<=', 'like' => 'LIKE'];
        foreach ((array) ($options['filters'] ?? []) as $filter) {
            $column = $filter['column'] ?? null;
            if (!is_string($column) || !isset($columns[$column])) {
                continue;
            }

            $operator = $filter['operator'] ?? '=';
            if ($operator === 'null' || $operator === 'not_null') {
                $clauses[] = $this->ident($column) . ($operator === 'null' ? ' IS NULL' : ' IS NOT NULL');
                continue;
            }
            if (!isset($operators[$operator])) {
                continue;
            }

            $clauses[] = $this->ident($column) . ' ' . $operators[$operator] . ' ?';
            $bindings[] = (string) ($filter['value'] ?? '');
        }

        return [$clauses ? ' WHERE ' . implode(' AND ', $clauses) : '', $bindings];
    }

    /**
     * Builds the WHERE clause matching exactly one row.
     */
    private function identify(Database $database, string $table, array $key): array
    {
        $structure = $this->structure($database, $table);
        $columns = $structure['primary'] ?: array_column(array_filter($structure['columns'], fn ($c) => !$c['binary']), 'name');

        $clauses = [];
        $bindings = [];
        foreach ($columns as $column) {
            if (!array_key_exists($column, $key)) {
                throw new DisplayException(__('The row could not be identified, reload the table and try again.'));
            }
            $clauses[] = $this->ident($column) . ' <=> ?';
            $bindings[] = $key[$column];
        }

        return [' WHERE ' . implode(' AND ', $clauses), $bindings];
    }

    private function onlyColumns(Database $database, string $table, array $values): array
    {
        $columns = array_column($this->structure($database, $table)['columns'], 'name');

        return array_intersect_key($values, array_flip($columns));
    }

    private function fetchRows(PDOStatement $statement, array $columns): array
    {
        $binary = array_column($columns, 'binary');
        $rows = [];
        $truncated = [];

        while (($row = $statement->fetch(PDO::FETCH_NUM)) !== false) {
            foreach ($row as $i => $value) {
                if (($binary[$i] ?? false) && $value !== null) {
                    $row[$i] = ['$binary' => strlen($value)];
                    continue;
                }
                [$row[$i], $cut] = $this->cell($value);
                if ($cut) {
                    $truncated[] = [count($rows), $i];
                }
            }
            $rows[] = $row;
        }

        return [$rows, $truncated];
    }

    /**
     * @return array{0: mixed, 1: bool}
     */
    private function cell(mixed $value): array
    {
        if (!is_string($value)) {
            return [$value, false];
        }
        if (!mb_check_encoding($value, 'UTF-8')) {
            return [['$binary' => strlen($value)], false];
        }
        if (strlen($value) > self::MAX_CELL) {
            return [mb_strcut($value, 0, self::MAX_CELL), true];
        }

        return [$value, false];
    }

    private function literal(PDO $pdo, mixed $value): string
    {
        return match (true) {
            $value === null => 'NULL',
            is_int($value), is_float($value) => (string) $value,
            is_bool($value) => $value ? '1' : '0',
            !mb_check_encoding((string) $value, 'UTF-8') => '0x' . bin2hex($value),
            default => $pdo->quote((string) $value),
        };
    }

    private function isBinary(string $type): bool
    {
        return in_array(strtolower($type), ['blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary', 'geometry', 'point', 'linestring', 'polygon'], true);
    }

    private function assertTable(Database $database, string $table): void
    {
        $exists = $this->prepare(
            $this->connection($database),
            'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            [$table]
        )->fetchColumn();

        if (!$exists) {
            throw new DisplayException(__('The table :table does not exist.', ['table' => $table]), null, DisplayException::LEVEL_WARNING);
        }
    }

    private function prepare(PDO $pdo, string $sql, array $bindings = []): PDOStatement
    {
        $statement = $pdo->prepare($sql);
        $statement->execute(array_values($bindings));

        return $statement;
    }

    private function ident(string $name): string
    {
        return '`' . str_replace('`', '``', $name) . '`';
    }
}
