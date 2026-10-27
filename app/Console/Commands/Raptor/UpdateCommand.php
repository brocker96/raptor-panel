<?php

namespace Raptor\Console\Commands\Raptor;

use Illuminate\Console\Command;
use Raptor\Services\Updates\Updater;
use Raptor\Services\Updates\ReleaseFeed;

class UpdateCommand extends Command
{
    protected $signature = 'raptor:update
        {version? : Release to install, the newest release on the update channel when omitted.}
        {--check : Only check for a new release.}
        {--rollback= : Restore the backup with this identifier, use "latest" for the newest one.}
        {--backups : List the backups that can be restored.}
        {--pending : Run an update requested from the admin area (used by the scheduler).}
        {--force : Do not ask for confirmation.}';

    protected $description = 'Updates Raptor Panel to a new release from GitHub, with an automatic backup and rollback.';

    public function handle(ReleaseFeed $feed, Updater $updater): int
    {
        if ($this->option('pending')) {
            if ($updater->state()['status'] === Updater::QUEUED) {
                $updater->onOutput(fn (string $line) => $this->line($line))->runPending();
            } elseif (config('raptor.updates.auto_check') && now()->minute === 7) {
                // Refresh the release list once an hour so the admin area can show a notice.
                rescue(fn () => $feed->releases(true), null, false);
            }

            return self::SUCCESS;
        }

        if ($this->option('backups')) {
            $this->table(['Backup', 'Version', 'Created', 'Size'], collect($updater->backups())->map(fn ($backup) => [
                $backup['id'], $backup['version'], $backup['created_at'], round($backup['size'] / 1048576, 1) . ' MB',
            ]));

            return self::SUCCESS;
        }

        if ($updater->busy()) {
            $this->error('Another update is already queued or running: ' . $updater->state()['step']);

            return self::FAILURE;
        }

        $updater->onOutput(fn (string $line) => $this->line($line));

        if ($backup = $this->option('rollback')) {
            if ($backup === 'latest') {
                $backup = $updater->backups()[0]['id'] ?? null;
                if (!$backup) {
                    $this->error('There are no backups to restore.');

                    return self::FAILURE;
                }
            }

            $this->warn("Restoring $backup replaces the Panel files and the database with the state of the backup, changes made since are lost.");
            if (!$this->option('force') && !$this->confirm('Continue?')) {
                return self::FAILURE;
            }

            $updater->rollback($backup);

            return $updater->state()['status'] === Updater::COMPLETED ? self::SUCCESS : self::FAILURE;
        }

        $this->line(sprintf('Installed version: %s, channel: %s, repository: %s', $feed->current(), $feed->channel(), $feed->repository()));
        try {
            $release = $this->argument('version') ? $feed->find($this->argument('version')) : $feed->latest(true);
        } catch (\Throwable $exception) {
            $this->error('Could not read the releases from GitHub: ' . strtok($exception->getMessage(), "\n"));

            return self::FAILURE;
        }

        if (!$release) {
            $this->error($this->argument('version') ? 'That release does not exist.' : 'No release was published on this channel yet.');

            return self::FAILURE;
        }

        if (!$this->argument('version') && !$feed->isNewer($release)) {
            $this->info("Raptor Panel is up to date ({$feed->current()}).");

            return self::SUCCESS;
        }

        $this->info("Release {$release['tag']} is available: {$release['url']}");
        if ($this->option('check')) {
            return self::SUCCESS;
        }

        if (!$this->option('force') && !$this->confirm("Install {$release['tag']} now? A backup is made first and restored automatically if anything fails.", true)) {
            return self::FAILURE;
        }

        $updater->install($release['version']);

        return $updater->state()['status'] === Updater::COMPLETED ? self::SUCCESS : self::FAILURE;
    }
}
