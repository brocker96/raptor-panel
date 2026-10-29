<?php

namespace Raptor\Services\Updates;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Filesystem\Filesystem;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\ExecutableFinder;

/**
 * Installs releases of the Panel in place and rolls them back again.
 *
 * Every update starts with a backup of the code, the .env file and the database. When any step of
 * the update fails the backup is restored automatically, so a failed update never leaves the Panel
 * half upgraded. Updates requested from the admin area are queued in a state file and picked up by
 * the scheduler, which runs as the same user as the web server and with the CLI PHP binary.
 */
class Updater
{
    public const IDLE = 'idle';
    public const QUEUED = 'queued';
    public const RUNNING = 'running';
    public const COMPLETED = 'completed';
    public const FAILED = 'failed';

    /**
     * Directories holding code that are replaced by a release or a backup. Everything else, most
     * importantly storage/ and .env, is left untouched.
     */
    private const CODE = ['app', 'bootstrap', 'config', 'database', 'resources', 'routes', 'public/build'];

    /** @var callable|null */
    private $output;

    public function __construct(private Filesystem $files, private ReleaseFeed $feed)
    {
    }

    public function path(string $append = ''): string
    {
        return storage_path('app/raptor/updates' . ($append ? '/' . ltrim($append, '/') : ''));
    }

    /**
     * Sends every log line to the callback as well, used by the console command.
     */
    public function onOutput(?callable $output): self
    {
        $this->output = $output;

        return $this;
    }

    public function state(): array
    {
        $state = rescue(fn () => json_decode($this->files->get($this->path('state.json')), true), null, false);

        return array_merge([
            'status' => self::IDLE,
            'action' => null,
            'target' => null,
            'step' => null,
            'error' => null,
            'requested_by' => null,
            'requested_at' => null,
            'started_at' => null,
            'finished_at' => null,
            'from' => null,
            'backup' => null,
        ], is_array($state) ? $state : []);
    }

    public function busy(): bool
    {
        $state = $this->state();

        if ($state['status'] === self::RUNNING && $state['started_at']) {
            // A worker that died without writing its result must not block updates forever.
            return CarbonImmutable::parse($state['started_at'])->gt(now()->subHour());
        }

        return $state['status'] === self::QUEUED;
    }

    public function log(int $lines = 400): string
    {
        $path = $this->path('update.log');
        if (!$this->files->exists($path)) {
            return '';
        }

        return implode("\n", array_slice(explode("\n", rtrim($this->files->get($path))), -$lines));
    }

    /**
     * Queues an update or rollback for the scheduler.
     */
    public function request(string $action, string $target, ?string $user = null): array
    {
        if ($this->busy()) {
            throw new UpdateException('Another update is already queued or running.');
        }

        $this->files->ensureDirectoryExists($this->path());
        $this->files->put($this->path('update.log'), '');

        return $this->write([
            'status' => self::QUEUED,
            'action' => $action,
            'target' => $target,
            'step' => 'Waiting for the scheduler to pick up the update',
            'error' => null,
            'requested_by' => $user,
            'requested_at' => now()->toAtomString(),
            'started_at' => null,
            'finished_at' => null,
            'from' => $this->feed->current(),
            'backup' => null,
        ]);
    }

    public function cancel(): void
    {
        if ($this->state()['status'] !== self::QUEUED) {
            throw new UpdateException('Only queued updates can be cancelled.');
        }

        $this->write(['status' => self::IDLE, 'step' => null]);
    }

    /**
     * Runs a queued request, returns false when there was nothing to do.
     */
    public function runPending(): bool
    {
        $state = $this->state();
        if ($state['status'] !== self::QUEUED) {
            return false;
        }

        $state['action'] === 'rollback' ? $this->rollback($state['target']) : $this->install($state['target']);

        return true;
    }

    /**
     * Installs the given release, any failure restores the backup made before.
     */
    public function install(string $version): void
    {
        $this->begin('install', $version);
        $backup = null;
        $touched = false;

        try {
            $release = $this->feed->find($version);
            if (!$release || !$release['archive']) {
                throw new UpdateException("Release $version was not found or has no panel.tar.gz asset.");
            }

            $this->checkRequirements();

            $this->step('Downloading release ' . $release['tag']);
            $archive = $this->download($release);

            $this->step('Backing up files and database');
            $backup = $this->backup();
            $this->write(['backup' => $backup]);

            $this->step('Enabling maintenance mode');
            $this->artisan(['down', '--retry=15']);

            $this->step('Replacing Panel files');
            $cached = $this->files->exists(base_path('bootstrap/cache/config.php'));
            $touched = true;
            $this->replaceCode($archive, keepVendor: true);

            $this->finish($cached);
            $this->files->delete($archive);
            $this->prune();
            $this->succeed("Raptor Panel was updated to $version.");
        } catch (\Throwable $exception) {
            $this->line('ERROR: ' . $exception->getMessage());

            if ($touched && $backup) {
                $this->line('Restoring the backup made before the update…');
                try {
                    $this->restore($backup, database: true);
                    $this->fail($exception, 'The update failed and the previous version was restored.');
                } catch (\Throwable $restore) {
                    $this->line('ERROR: ' . $restore->getMessage());
                    $this->fail($restore, "The update failed and restoring backup $backup failed as well, restore it with: php artisan raptor:update --rollback=$backup");
                }
            } else {
                $this->artisan(['up'], false);
                $this->fail($exception, 'The update failed before any file was changed.');
            }
        }
    }

    /**
     * Restores a backup made before an earlier update, including its database.
     */
    public function rollback(string $backup): void
    {
        $this->begin('rollback', $backup);

        try {
            if (!$this->files->isDirectory($this->path("backups/$backup"))) {
                throw new UpdateException("Backup $backup does not exist.");
            }

            $this->restore($backup, database: true);
            $this->succeed('The backup ' . $backup . ' was restored.');
        } catch (\Throwable $exception) {
            $this->line('ERROR: ' . $exception->getMessage());
            $this->artisan(['up'], false);
            $this->fail($exception, 'The rollback failed.');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function backups(): array
    {
        if (!$this->files->isDirectory($this->path('backups'))) {
            return [];
        }

        return collect($this->files->directories($this->path('backups')))
            ->map(function (string $directory) {
                $meta = rescue(fn () => json_decode($this->files->get("$directory/meta.json"), true), [], false);

                return [
                    'id' => basename($directory),
                    'version' => $meta['version'] ?? 'unknown',
                    'created_at' => $meta['created_at'] ?? null,
                    'size' => collect($this->files->files($directory))->sum(fn ($file) => $file->getSize()),
                    'database' => $this->files->exists("$directory/database.sql.gz"),
                ];
            })
            ->sortByDesc('id')
            ->values()
            ->all();
    }

    /**
     * Backs up the code, the .env file and the database, returns the identifier of the backup.
     */
    public function backup(): string
    {
        $id = now()->format('Ymd-His') . '-' . Str::slug($this->feed->current());
        $directory = $this->path("backups/$id");
        $this->files->ensureDirectoryExists($directory);

        try {
            $this->run([
                'tar', '-czf', "$directory/files.tar.gz",
                '--exclude=./storage', '--exclude=./node_modules', '--exclude=./.git',
                '-C', base_path(), '.',
            ]);

            $this->dumpDatabase("$directory/database.sql.gz");
        } catch (\Throwable $exception) {
            $this->files->deleteDirectory($directory);

            throw $exception;
        }

        $this->files->put("$directory/meta.json", json_encode([
            'version' => $this->feed->current(),
            'created_at' => now()->toAtomString(),
        ]));

        $this->line("Backup stored in $directory");

        return $id;
    }

    private function restore(string $backup, bool $database): void
    {
        $directory = $this->path("backups/$backup");

        $this->step('Enabling maintenance mode');
        $this->artisan(['down', '--retry=15'], false);

        // The database goes first, while the code loaded by this process is still on disk.
        if ($database && $this->files->exists("$directory/database.sql.gz")) {
            $this->step('Restoring the database');
            $this->restoreDatabase("$directory/database.sql.gz");
        }

        $this->step('Restoring files of backup ' . $backup);
        $this->replaceCode("$directory/files.tar.gz", keepVendor: false);

        $this->step('Clearing caches');
        $this->artisan(['optimize:clear'], false);
        $this->artisan(['queue:restart'], false);
        $this->artisan(['up'], false);
    }

    /**
     * Removes the code directories and unpacks the archive over the installation.
     */
    private function replaceCode(string $archive, bool $keepVendor): void
    {
        $listing = $this->run(['tar', '-tzf', $archive], quiet: true);
        foreach (['artisan', 'config/app.php', 'bootstrap/app.php'] as $required) {
            if (!preg_match('#^(\./)?' . preg_quote($required, '#') . '$#m', $listing)) {
                throw new UpdateException("The archive does not look like a Raptor Panel release, $required is missing.");
            }
        }

        $directories = $keepVendor ? self::CODE : [...self::CODE, 'vendor'];
        foreach ($directories as $directory) {
            $this->files->deleteDirectory(base_path($directory));
        }

        $this->run(['tar', '-xzf', $archive, '-C', base_path(), '--exclude=.env', '--exclude=./.env', '--no-same-owner']);
        $this->files->ensureDirectoryExists(base_path('bootstrap/cache'));
    }

    /**
     * Refuses release archives that could write outside the installation: absolute paths, ".."
     * in a path, and links that point outside the directory they are unpacked in. Backups made
     * by the updater itself are not checked, they hold the links of the installation.
     */
    private function assertSafeArchive(string $archive): void
    {
        foreach (preg_split('/\R/', trim($this->run(['tar', '-tzf', $archive], quiet: true))) as $entry) {
            if (str_starts_with($entry, '/') || in_array('..', explode('/', $entry), true)) {
                throw new UpdateException("The archive contains an unsafe path: $entry");
            }
        }

        $verbose = $this->run(['tar', '-tvzf', $archive], quiet: true);
        foreach (preg_split('/\R/', trim($verbose)) as $line) {
            if (!in_array($line[0] ?? '', ['l', 'h'], true)) {
                continue;
            }

            $target = trim((string) preg_replace('/^.*? (?:->|link to) /', '', $line));
            if (str_starts_with($target, '/') || in_array('..', explode('/', $target), true)) {
                throw new UpdateException("The archive contains a link that leaves the Panel directory: $line");
            }
        }
    }

    /**
     * Runs the usual post-update commands. These run in new processes as the code of this one
     * was replaced.
     */
    private function finish(bool $cache): void
    {
        $this->step('Installing PHP dependencies');
        $composer = (new ExecutableFinder())->find('composer', null, ['/usr/local/bin', '/usr/bin']);
        if (!$composer) {
            throw new UpdateException('Composer was not found, install it to update the Panel.');
        }
        $this->run([PHP_BINARY, $composer, 'install', '--no-dev', '--optimize-autoloader', '--no-interaction', '--no-ansi'], env: [
            'COMPOSER_HOME' => $this->path('composer'),
            'COMPOSER_ALLOW_SUPERUSER' => '1',
        ], timeout: 900);

        $this->step('Migrating the database');
        $this->artisan(['optimize:clear']);
        $this->artisan(['migrate', '--force', '--seed']);
        // A database host that is down must not stop the update, the command can be run again.
        $this->artisan(['raptor:database:repair-grants'], throw: false);
        if ($cache) {
            // The installer caches the configuration, routes and views, keep it that way.
            $this->artisan(['config:cache']);
            $this->artisan(['route:cache']);
            $this->artisan(['view:cache']);
        }

        $this->step('Restarting the queue worker');
        $this->artisan(['queue:restart']);
        $this->fixOwnership();
        $this->artisan(['up']);
    }

    private function download(array $release): string
    {
        $this->files->ensureDirectoryExists($this->path('downloads'));
        $target = $this->path('downloads/' . Str::slug($release['tag']) . '.tar.gz');

        foreach (['archive', 'checksum'] as $key) {
            if (!is_string($release[$key] ?? null) || !str_starts_with($release[$key], 'https://')) {
                throw new UpdateException("The release has no HTTPS $key URL, updates are only installed when their checksum can be verified.");
            }
        }

        $this->line('GET ' . $release['archive']);
        Http::timeout(600)->withHeaders(['User-Agent' => 'Raptor-Panel'])->sink($target)->get($release['archive'])->throw();

        $expected = strtolower(strtok(trim(Http::timeout(30)->get($release['checksum'])->throw()->body()), " \t\n") ?: '');
        $actual = hash_file('sha256', $target);
        if (!hash_equals($expected, $actual)) {
            $this->files->delete($target);

            throw new UpdateException("Checksum mismatch, expected $expected but the download is $actual.");
        }
        $this->line("Checksum verified ($actual)");

        $this->assertSafeArchive($target);

        return $target;
    }

    private function checkRequirements(): void
    {
        foreach (['tar', 'mysqldump', 'mysql', 'gzip'] as $binary) {
            if (!(new ExecutableFinder())->find($binary)) {
                throw new UpdateException("The \"$binary\" command is required to update the Panel.");
            }
        }

        $free = (int) @disk_free_space(storage_path());
        if ($free && $free < 512 * 1024 * 1024) {
            throw new UpdateException('At least 512 MB of free disk space is required to update the Panel.');
        }

        if (!is_writable(base_path('app')) || !is_writable(base_path())) {
            throw new UpdateException('The Panel files are not writable by ' . (posix_getpwuid(posix_geteuid())['name'] ?? 'this user') . ', run "chown -R www-data:www-data ' . base_path() . '".');
        }
    }

    private function dumpDatabase(string $target): void
    {
        $db = config('database.connections.' . config('database.default'));

        $this->run(['sh', '-c', 'mysqldump --single-transaction --quick --routines --no-tablespaces "$@" | gzip > ' . escapeshellarg($target), 'sh', ...$this->databaseArguments($db)], env: ['MYSQL_PWD' => (string) $db['password']], quiet: true);
    }

    private function restoreDatabase(string $source): void
    {
        $db = config('database.connections.' . config('database.default'));

        // Tables created by a failed migration are not part of the dump and would break the next
        // attempt, so the database is emptied first.
        $schema = DB::connection()->getSchemaBuilder();
        $schema->dropAllViews();
        $schema->dropAllTables();

        $this->run(['sh', '-c', 'gunzip -c ' . escapeshellarg($source) . ' | mysql "$@"', 'sh', ...$this->databaseArguments($db)], env: ['MYSQL_PWD' => (string) $db['password']]);
    }

    private function databaseArguments(array $db): array
    {
        $arguments = ['--user=' . $db['username']];
        if (!empty($db['unix_socket'])) {
            $arguments[] = '--socket=' . $db['unix_socket'];
        } else {
            $arguments[] = '--host=' . $db['host'];
            $arguments[] = '--port=' . $db['port'];
        }
        $arguments[] = $db['database'];

        return $arguments;
    }

    /**
     * Files written while running as root would no longer be writable by the web server.
     */
    private function fixOwnership(): void
    {
        if (!function_exists('posix_geteuid') || posix_geteuid() !== 0) {
            return;
        }

        $owner = posix_getpwuid(fileowner(base_path('storage')))['name'] ?? 'www-data';
        $group = posix_getgrgid(filegroup(base_path('storage')))['name'] ?? 'www-data';
        $this->run(['chown', '-R', "$owner:$group", base_path()], quiet: true);
    }

    /**
     * Keeps the configured number of backups, the newest ones survive.
     */
    private function prune(): void
    {
        $keep = max(1, (int) config('raptor.updates.keep_backups', 3));

        foreach (array_slice($this->backups(), $keep) as $backup) {
            $this->files->deleteDirectory($this->path('backups/' . $backup['id']));
            $this->line('Removed old backup ' . $backup['id']);
        }
    }

    private function artisan(array $arguments, bool $throw = true): void
    {
        try {
            $this->run([PHP_BINARY, base_path('artisan'), ...$arguments, '--no-interaction'], timeout: 900);
        } catch (\Throwable $exception) {
            if ($throw) {
                throw $exception;
            }
        }
    }

    private function run(array $command, array $env = [], int $timeout = 600, bool $quiet = false): string
    {
        $this->line('$ ' . implode(' ', array_map(fn ($part) => str_contains($part, ' ') ? escapeshellarg($part) : $part, $command)));

        $process = new Process($command, base_path(), $env ?: null, null, $timeout);
        $output = '';
        $process->run(function ($type, $buffer) use (&$output, $quiet) {
            $output .= $buffer;
            if (!$quiet) {
                foreach (explode("\n", rtrim($buffer)) as $line) {
                    $this->line('  ' . $line);
                }
            }
        });

        if (!$process->isSuccessful()) {
            if ($quiet) {
                $this->line('  ' . trim(Str::limit($process->getErrorOutput() ?: $output, 2000)));
            }

            $name = $command[0] === PHP_BINARY ? basename($command[1]) . (isset($command[2]) && str_starts_with($command[2], '-') === false ? ' ' . $command[2] : '') : basename($command[0]);
            $reason = collect(explode("\n", $process->getErrorOutput() . "\n" . $output))
                ->map(fn ($line) => trim($line))
                ->filter(fn ($line) => $line !== '' && !str_starts_with($line, '#') && !str_starts_with($line, 'at ') && !preg_match('/^\d+[▕|]/u', $line))
                ->last();

            throw new UpdateException(sprintf('"%s" failed (exit code %d)%s', $name, $process->getExitCode(), $reason ? ': ' . Str::limit($reason, 300) : '.'));
        }

        return $output;
    }

    private function begin(string $action, string $target): void
    {
        // Loaded up front, the files on disk are replaced while the update runs.
        class_exists(UpdateException::class);
        $state = $this->state();
        $this->files->ensureDirectoryExists($this->path());
        if ($state['status'] !== self::QUEUED) {
            $this->files->put($this->path('update.log'), '');
        }

        $this->write([
            'status' => self::RUNNING,
            'action' => $action,
            'target' => $target,
            'error' => null,
            'started_at' => now()->toAtomString(),
            'finished_at' => null,
            'from' => $this->feed->current(),
            'backup' => null,
        ]);
        $this->line(sprintf('%s %s on %s', $action === 'install' ? 'Updating to' : 'Rolling back to backup', $target, now()->toDateTimeString()));
    }

    private function step(string $step): void
    {
        $this->write(['step' => $step]);
        $this->line("==> $step");
    }

    private function succeed(string $message): void
    {
        $this->line($message);
        $this->write(['status' => self::COMPLETED, 'step' => $message, 'finished_at' => now()->toAtomString()]);
    }

    private function fail(\Throwable $exception, string $message): void
    {
        $this->line($message);
        $this->write([
            'status' => self::FAILED,
            'step' => $message,
            'error' => $exception->getMessage(),
            'finished_at' => now()->toAtomString(),
        ]);
    }

    private function write(array $values): array
    {
        $state = array_merge($this->state(), $values);
        $this->files->ensureDirectoryExists($this->path());
        $this->files->put($this->path('state.json'), json_encode($state, JSON_PRETTY_PRINT));

        return $state;
    }

    private function line(string $line): void
    {
        $this->files->ensureDirectoryExists($this->path());
        $this->files->append($this->path('update.log'), '[' . now()->format('H:i:s') . "] $line\n");

        if ($this->output) {
            ($this->output)($line);
        }
    }
}
