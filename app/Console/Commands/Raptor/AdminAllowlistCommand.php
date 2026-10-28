<?php

namespace Raptor\Console\Commands\Raptor;

use Illuminate\Console\Command;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;

/**
 * Shows or clears the IP allowlist of the admin area, for administrators that locked themselves out.
 */
class AdminAllowlistCommand extends Command
{
    protected $signature = 'raptor:admin-allowlist {--clear : Allow every IP address to open the admin area again}';

    protected $description = 'Show or clear the IP allowlist of the admin area.';

    public function handle(SettingsRepositoryInterface $settings): int
    {
        if ($this->option('clear')) {
            $settings->set('settings::raptor:security:admin_allowlist', '(empty)');
            $this->call('config:clear');
            $this->info('The admin area can be opened from every IP address again.');

            return self::SUCCESS;
        }

        $value = trim((string) config('raptor.security.admin_allowlist'));
        $this->line($value === '' ? 'The admin area can be opened from every IP address.' : "Allowed addresses: $value");

        return self::SUCCESS;
    }
}
