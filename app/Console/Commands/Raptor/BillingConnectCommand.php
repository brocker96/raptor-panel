<?php

namespace Raptor\Console\Commands\Raptor;

use Raptor\Models\User;
use Raptor\Models\ApiKey;
use Illuminate\Support\Str;
use Raptor\Facades\Activity;
use Raptor\Models\RaptorWebhook;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Services\Api\KeyCreationService;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;
use Raptor\Http\Controllers\Api\Admin\RaptorApiController;

/**
 * Connects a Raptor Billing installation in one step: an API key for it, a webhook to it and the
 * billing links in the account menu. Used by the billing installer when both run on one server,
 * prints JSON with the key and the webhook secret.
 */
class BillingConnectCommand extends Command
{
    protected $signature = 'raptor:billing:connect
        {--url= : Address of the billing, e.g. https://billing.example.com}
        {--json : Only print the credentials as JSON.}';

    protected $description = 'Create an API key and a webhook for Raptor Billing and link the billing in the Panel.';

    public function handle(KeyCreationService $creation, Encrypter $encrypter, SettingsRepositoryInterface $settings): int
    {
        $url = rtrim((string) $this->option('url'), '/');
        if (!preg_match('#^https?://[^\s/]+#', $url)) {
            $this->error('Pass the billing address with --url=https://billing.example.com');

            return self::FAILURE;
        }

        $admin = User::query()->where('root_admin', true)->orderBy('id')->first();
        if (!$admin) {
            $this->error('Create an administrator first, the key belongs to one.');

            return self::FAILURE;
        }

        $key = $creation->setKeyType(ApiKey::TYPE_APPLICATION)->handle([
            'memo' => 'Raptor Billing (' . parse_url($url, PHP_URL_HOST) . ')',
            'user_id' => $admin->id,
            'allowed_ips' => [],
        ], RaptorApiController::BILLING_PERMISSIONS);

        $secret = 'whsec_' . Str::random(40);
        RaptorWebhook::query()->where('url', "$url/webhooks/raptor")->delete();
        RaptorWebhook::query()->create([
            'url' => "$url/webhooks/raptor",
            'secret' => $secret,
            'events' => RaptorWebhook::EVENTS,
            'active' => true,
            'description' => 'Raptor Billing',
        ]);

        $settings->set('settings::raptor:billing:url', "$url/dashboard");
        $settings->set('settings::raptor:billing:server_url', "$url/services/ext/{external_id}");
        $this->callSilently('config:clear');

        Activity::event('admin:billing.connect')->property('url', $url)->log();

        $credentials = ['panel_url' => rtrim((string) config('app.url'), '/'), 'key' => $key->identifier . $encrypter->decrypt($key->token), 'webhook_secret' => $secret];
        if ($this->option('json')) {
            $this->line(json_encode($credentials));
        } else {
            $this->info("Billing at $url is connected. Key: {$key->identifier}…, webhook: $url/webhooks/raptor");
        }

        return self::SUCCESS;
    }
}
