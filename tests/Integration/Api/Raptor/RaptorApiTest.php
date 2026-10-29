<?php

namespace Raptor\Tests\Integration\Api\Raptor;

use Raptor\Models\Egg;
use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\Server;
use Raptor\Models\Location;
use Raptor\Models\Allocation;
use Raptor\Models\RaptorWebhook;
use Raptor\Models\ServerPackage;
use Illuminate\Support\Facades\Bus;
use Raptor\Jobs\DeliverRaptorWebhook;
use Raptor\Services\Acl\Api\AdminAcl;
use Illuminate\Support\Facades\Notification;
use Raptor\Repositories\Wings\DaemonServerRepository;
use Raptor\Tests\Integration\Api\Application\ApplicationApiIntegrationTestCase;

class RaptorApiTest extends ApplicationApiIntegrationTestCase
{
    private ServerPackage $package;

    public function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $daemon = \Mockery::mock(DaemonServerRepository::class);
        $daemon->allows('setServer')->andReturnSelf();
        $daemon->shouldReceive('create', 'sync', 'delete', 'reinstall')->andReturnNull();
        $this->swap(DaemonServerRepository::class, $daemon);

        $location = Location::factory()->create();
        $node = Node::factory()->create(['location_id' => $location->id, 'memory' => 16384, 'disk' => 102400, 'public' => true]);
        Allocation::factory()->count(3)->create(['node_id' => $node->id]);

        $egg = Egg::query()->where('author', 'support@pterodactyl.io')->where('name', 'Bungeecord')->firstOrFail();
        $this->package = ServerPackage::query()->create([
            'slug' => 'proxy-1g',
            'name' => 'Proxy 1 GB',
            'egg_id' => $egg->id,
            'memory' => 1024,
            'disk' => 5120,
            'backup_limit' => 2,
            'location_ids' => [$location->id],
        ]);
    }

    private function api(string $path): string
    {
        return '/api/raptor/v1' . $path;
    }

    public function testPingShowsTheKeyPermissions()
    {
        $this->getJson($this->api('/'))
            ->assertOk()
            ->assertJsonPath('api', 'raptor')
            ->assertJsonPath('key.permissions.servers', 'write')
            ->assertJsonPath('packages', 1);
    }

    public function testProvisioningCreatesTheUserAndServerOnceForTheSameOrder()
    {
        $body = [
            'package' => 'proxy-1g',
            'external_id' => 'order-1042',
            'user' => ['email' => 'Jane.Doe+shop@example.com', 'external_id' => 'client-7', 'first_name' => 'Jane'],
            'overrides' => ['memory' => 2048, 'egg_id' => 999],
            'login_link' => true,
        ];

        $response = $this->postJson($this->api('/servers'), $body)
            ->assertCreated()
            ->assertJsonPath('existing', false)
            ->assertJsonPath('server.external_id', 'order-1042')
            ->assertJsonPath('server.package.slug', 'proxy-1g')
            ->assertJsonPath('server.limits.memory', 2048)
            ->assertJsonPath('server.feature_limits.backups', 2)
            ->assertJsonPath('user.created', true)
            ->assertJsonPath('user.username', 'jane.doe');
        $this->assertStringContainsString('/auth/link/', $response->json('login_link.url'));

        $user = User::query()->where('external_id', 'client-7')->firstOrFail();
        $this->assertSame('jane.doe+shop@example.com', $user->email);

        // A retry of the same order returns the same server.
        $this->postJson($this->api('/servers'), $body)->assertOk()->assertJsonPath('existing', true)
            ->assertJsonPath('server.id', $response->json('server.id'));
        $this->assertSame(1, Server::query()->count());

        // Everything can be addressed by the billing ids.
        $this->getJson($this->api('/servers/ext:order-1042'))->assertOk()->assertJsonPath('server', null)->assertJsonPath('owner.external_id', 'client-7');
        $this->getJson($this->api('/users/ext:client-7/servers'))->assertOk()->assertJsonCount(1, 'data');
    }

    public function testLifecycleByExternalId()
    {
        $user = User::factory()->create();
        $this->postJson($this->api('/servers'), ['package' => 'proxy-1g', 'external_id' => 'o-1', 'user' => $user->email])->assertCreated();

        $big = ServerPackage::query()->create(['slug' => 'proxy-4g', 'name' => 'Proxy 4 GB', 'egg_id' => $this->package->egg_id, 'memory' => 4096, 'disk' => 20480]);

        $this->postJson($this->api('/servers/ext:o-1/suspend'))->assertOk()->assertJsonPath('state', 'suspended');
        $this->postJson($this->api('/servers/ext:o-1/unsuspend'))->assertOk()->assertJsonPath('state', 'active');
        $this->putJson($this->api('/servers/ext:o-1/package'), ['package' => $big->slug])->assertOk()
            ->assertJsonPath('package.slug', 'proxy-4g')->assertJsonPath('limits.memory', 4096);
        $this->patchJson($this->api('/servers/ext:o-1/limits'), ['backup_limit' => 9])->assertOk()
            ->assertJsonPath('feature_limits.backups', 9)->assertJsonPath('limits.memory', 4096);
        $this->patchJson($this->api('/servers/ext:o-1'), ['name' => 'Renamed'])->assertOk()->assertJsonPath('name', 'Renamed');
        $this->deleteJson($this->api('/servers/ext:o-1'))->assertNoContent();
        $this->getJson($this->api('/servers/ext:o-1'))->assertNotFound();
    }

    public function testIdempotencyKeyReplaysTheFirstAnswer()
    {
        $headers = ['Idempotency-Key' => 'abc-1'];
        $body = ['email' => 'idem@example.com', 'send_welcome_email' => false];

        $first = $this->postJson($this->api('/users'), $body, $headers)->assertCreated();
        $this->postJson($this->api('/users'), $body, $headers)->assertCreated()->assertHeader('Idempotent-Replayed', 'true')
            ->assertJsonPath('id', $first->json('id'));
        $this->postJson($this->api('/users'), $body)->assertOk()->assertJsonPath('created', false);

        // Last: the error handler rolls back open transactions, the test's own included.
        $this->postJson($this->api('/users'), ['email' => 'other@example.com'], $headers)->assertUnprocessable();
    }

    public function testLoginLinksSignInOnce()
    {
        $user = User::factory()->create();
        $url = $this->postJson($this->api("/users/{$user->uuid}/login-link"), ['redirect' => '//evil.example/x'])->assertCreated()->json('url');
        $path = parse_url($url, PHP_URL_PATH);

        $this->flushHeaders();
        $this->get($path)->assertRedirect('/evil.example/x');
        $this->assertAuthenticatedAs($user, 'web');

        auth('web')->logout();
        $this->get($path)->assertRedirect('/auth/login');
        $this->assertGuest('web');
    }

    public function testAdminsGetNoLoginLinks()
    {
        $this->postJson($this->api('/users/' . $this->getApiUser()->uuid . '/login-link'))->assertForbidden();
    }

    public function testPackagesAndAvailability()
    {
        $this->getJson($this->api('/packages'))->assertOk()->assertJsonPath('data.0.slug', 'proxy-1g');
        $this->getJson($this->api('/packages/proxy-1g/availability'))->assertOk()->assertJsonPath('available', true);

        $this->patchJson($this->api('/packages/proxy-1g'), ['memory' => 999999])->assertOk();
        $this->getJson($this->api('/packages/proxy-1g/availability'))->assertJsonPath('available', false)->assertJsonPath('reason', 'no_node_with_capacity');

        $this->postJson($this->api('/packages/proxy-1g/duplicate'))->assertCreated()->assertJsonPath('slug', 'proxy-1g-copy')->assertJsonPath('active', false);
        $this->postJson($this->api('/packages'), ['slug' => 'Bad Slug', 'name' => 'x', 'egg_id' => $this->package->egg_id, 'memory' => 1, 'disk' => 1])->assertUnprocessable();
    }

    public function testWebhooksAreSignedAndOnlyForChosenEvents()
    {
        Bus::fake([DeliverRaptorWebhook::class]);
        $secret = $this->postJson($this->api('/webhooks'), ['url' => 'https://billing.example/hook', 'events' => ['server.suspended']])->assertCreated()->json('secret');
        $this->assertStringStartsWith('whsec_', $secret);

        $user = User::factory()->create();
        $this->postJson($this->api('/servers'), ['package' => 'proxy-1g', 'external_id' => 'o-9', 'user' => $user->email])->assertCreated();
        $this->assertSame(0, RaptorWebhook::query()->first()->deliveries()->count());

        $this->postJson($this->api('/servers/ext:o-9/suspend'))->assertOk();
        $delivery = RaptorWebhook::query()->first()->deliveries()->firstOrFail();
        $this->assertSame('server.suspended', $delivery->event);
        $this->assertSame('o-9', $delivery->payload['data']['server']['external_id']);
        Bus::assertDispatched(DeliverRaptorWebhook::class);

        $this->assertSame('t=1700000000,v1=' . hash_hmac('sha256', '1700000000.{}', 'k'), \Raptor\Services\RaptorApi\Webhooks::signature('k', '{}', 1700000000));
    }

    public function testKeysNeedTheRightPermissions()
    {
        $this->createNewDefaultApiKey($this->getApiUser(), ['r_servers' => AdminAcl::READ, 'r_users' => AdminAcl::READ]);

        $this->getJson($this->api('/servers'))->assertOk();
        $this->postJson($this->api('/servers'), ['package' => 'proxy-1g', 'user' => 'x@y.z'])->assertForbidden();
        $this->postJson($this->api('/users'), ['email' => 'x@y.z'])->assertForbidden();
    }
}
