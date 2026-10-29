<?php

namespace Raptor\Console\Commands\Raptor;

use Raptor\Models\Database;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\DatabaseManager;
use Raptor\Extensions\DynamicDatabaseConnection;
use Raptor\Repositories\Eloquent\DatabaseRepository;

/**
 * Re-creates the grants of every server database with the database name escaped. Grants made
 * by older versions used the raw name, in which MySQL reads "_" and "%" as wildcards, so a
 * database user could reach databases of other servers whose names happened to match.
 */
class RepairDatabaseGrantsCommand extends Command
{
    protected $signature = 'raptor:database:repair-grants';

    protected $description = 'Re-grant every server database so its user can only reach that one database.';

    public function handle(DynamicDatabaseConnection $dynamic, DatabaseManager $connections, DatabaseRepository $repository): int
    {
        $failed = 0;
        $repaired = 0;

        Database::query()->orderBy('database_host_id')->get()->groupBy('database_host_id')->each(
            function ($databases, $hostId) use ($dynamic, $connections, $repository, &$failed, &$repaired) {
                try {
                    $dynamic->set('dynamic', (int) $hostId);
                    $connections->purge('dynamic');
                    $repository->setConnection('dynamic');

                    foreach ($databases as $database) {
                        // The DB Manager may have added an account for the host the panel connects from.
                        $remotes = array_unique(array_filter([$database->remote, Cache::get('db_manager:panel_host:' . $database->id)], 'is_string'));

                        foreach ($remotes as $remote) {
                            // Only accounts that still hold an old grant get a new one, so running
                            // this twice is harmless and no account is created by accident.
                            if ($repository->revokeUnescapedGrant($database->database, $database->username, $remote)) {
                                $repository->assignUserToDatabase($database->database, $database->username, $remote);
                                ++$repaired;
                            }
                        }
                    }

                    $repository->flush();
                } catch (\Throwable $exception) {
                    ++$failed;
                    $this->warn("Database host #$hostId could not be repaired: {$exception->getMessage()}");
                }
            }
        );

        $this->info("Repaired $repaired grant(s).");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
