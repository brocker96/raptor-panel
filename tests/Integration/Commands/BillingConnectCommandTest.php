<?php

namespace Raptor\Tests\Integration\Commands;

use Raptor\Models\User;
use Raptor\Models\ApiKey;
use Raptor\Models\RaptorWebhook;
use Illuminate\Support\Facades\Artisan;
use Raptor\Tests\Integration\IntegrationTestCase;

class BillingConnectCommandTest extends IntegrationTestCase
{
    public function testConnectsBillingWithKeyWebhookAndLinks(): void
    {
        User::factory()->create(['root_admin' => true]);

        $this->assertSame(0, Artisan::call('raptor:billing:connect', ['--url' => 'https://billing.example.com/', '--json' => true]));
        $out = json_decode(trim(Artisan::output()), true);

        $this->assertStringStartsWith('ptla_', $out['key']);
        $this->assertStringStartsWith('whsec_', $out['webhook_secret']);
        $this->assertSame(1, ApiKey::query()->where('key_type', ApiKey::TYPE_APPLICATION)->count());

        $hook = RaptorWebhook::query()->sole();
        $this->assertSame('https://billing.example.com/webhooks/raptor', $hook->url);
        $this->assertSame($out['webhook_secret'], $hook->secret);

        // Running it again replaces the webhook instead of adding a second one.
        Artisan::call('raptor:billing:connect', ['--url' => 'https://billing.example.com', '--json' => true]);
        $this->assertSame(1, RaptorWebhook::query()->count());
    }

    public function testRefusesWithoutUrl(): void
    {
        $this->assertSame(1, Artisan::call('raptor:billing:connect'));
    }
}
