<?php

namespace Raptor\Tests\Integration\Api\Admin;

use Raptor\Models\Egg;
use Raptor\Models\Nest;
use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\Mount;
use Raptor\Models\ApiKey;
use Raptor\Models\Server;
use Raptor\Models\Location;
use Raptor\Models\Allocation;
use Raptor\Helpers\Cloudflare;
use Raptor\Models\ActivityLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Tests\Integration\IntegrationTestCase;

class AdminApiTest extends IntegrationTestCase
{
    private User $admin;

    public function setUp(): void
    {
        parent::setUp();

        $this->cleanup();

        $this->admin = User::factory()->create(['root_admin' => true]);
    }

    protected function tearDown(): void
    {
        $this->cleanup();

        parent::tearDown();
    }

    private function cleanup(): void
    {
        \Raptor\Models\Setting::query()->where('key', 'like', 'settings::raptor:cloudflare:%')->delete();
        \Raptor\Models\Setting::query()->where('key', 'settings::mail:default')->delete();
        ActivityLog::query()->delete();
        ApiKey::query()->delete();
        Mount::query()->delete();
        Server::query()->forceDelete();
        Allocation::query()->delete();
        Node::query()->forceDelete();
        Location::query()->forceDelete();
        User::query()->forceDelete();
        Egg::query()->whereIn('nest_id', Nest::query()->where('name', 'Custom')->pluck('id'))->delete();
        Nest::query()->where('name', 'Custom')->delete();
    }

    public function testNonAdminsAndApiKeysCannotUseTheAdminApi(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/admin/overview')->assertForbidden();

        // A valid application API key still has no access, it must use /api/application.
        $key = ApiKey::factory()->create(['user_id' => $this->admin->id, 'key_type' => ApiKey::TYPE_APPLICATION, 'r_servers' => AdminAcl::READ | AdminAcl::WRITE]);
        $this->withHeader('Authorization', 'Bearer ' . $key->identifier . decrypt($key->token))
            ->getJson('/api/admin/overview')
            ->assertForbidden();
    }

    public function testOverviewAndSystem(): void
    {
        $server = $this->createServerModel();

        $this->actingAs($this->admin)->getJson('/api/admin/overview')
            ->assertOk()
            ->assertJsonPath('counts.servers', 1)
            ->assertJsonPath('servers.installed', 1)
            ->assertJsonPath('nodes.0.id', $server->node_id)
            ->assertJsonCount(14, 'activity');

        $this->actingAs($this->admin)->getJson('/api/admin/system')
            ->assertOk()
            ->assertJsonStructure(['panel' => ['version'], 'software' => ['php', 'laravel', 'database'], 'drivers', 'extensions', 'checks', 'disk']);
    }

    public function testServerListSearchAndView(): void
    {
        $owner = User::factory()->create(['username' => 'needle-owner']);
        $server = $this->createServerModel(['owner_id' => $owner->id, 'name' => 'Alpha']);
        $this->createServerModel(['name' => 'Beta']);

        $this->actingAs($this->admin)->getJson('/api/admin/servers?search=needle')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $server->id)
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($this->admin)->getJson("/api/admin/servers?node={$server->node_id}&status=installed")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($this->admin)->getJson("/api/admin/servers/{$server->id}")
            ->assertOk()
            ->assertJsonPath('name', 'Alpha')
            ->assertJsonPath('owner.username', 'needle-owner')
            ->assertJsonStructure(['limits', 'feature_limits', 'container', 'allocations', 'variables', 'databases', 'mounts']);

        $this->actingAs($this->admin)->postJson("/api/admin/servers/{$server->id}/toggle-install")->assertNoContent();
        $this->assertSame(Server::STATUS_INSTALLING, $server->refresh()->status);
    }

    public function testUserManagement(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'email' => 'new@example.com',
            'username' => 'newbie',
            'name_first' => 'New',
            'name_last' => 'User',
            'password' => 'Sup3rSecret!',
            'root_admin' => false,
        ])->assertCreated();

        $id = $response->json('id');
        $this->actingAs($this->admin)->getJson('/api/admin/users?search=newbie')->assertJsonPath('data.0.id', $id);
        $this->actingAs($this->admin)->getJson('/api/admin/users?filter=admins')->assertJsonPath('meta.total', 1);

        $this->actingAs($this->admin)->patchJson("/api/admin/users/{$id}", [
            'email' => 'new@example.com', 'username' => 'renamed', 'name_first' => 'New', 'name_last' => 'User', 'root_admin' => true,
        ])->assertOk()->assertJsonPath('username', 'renamed')->assertJsonPath('root_admin', true);

        User::query()->whereKey($id)->update(['use_totp' => true, 'totp_secret' => 'abc']);
        $this->actingAs($this->admin)->postJson("/api/admin/users/{$id}/2fa/disable")->assertNoContent();
        $this->assertFalse(User::query()->findOrFail($id)->use_totp);

        // Administrators cannot lock themselves out.
        $this->actingAs($this->admin)->deleteJson("/api/admin/users/{$this->admin->id}")->assertStatus(400);
        $this->actingAs($this->admin)->deleteJson("/api/admin/users/{$id}")->assertNoContent();

        $this->assertTrue(ActivityLog::query()->where('event', 'admin:user.create')->exists());
    }

    public function testNodesAndAllocations(): void
    {
        $location = Location::factory()->create();
        $this->actingAs($this->admin)->postJson('/api/admin/nodes', [
            'name' => 'Node A', 'location_id' => $location->id, 'public' => true, 'fqdn' => '127.0.0.1', 'scheme' => 'http',
            'behind_proxy' => false, 'memory' => 4096, 'memory_overallocate' => 0, 'disk' => 10000, 'disk_overallocate' => 0,
            'daemonBase' => '/var/lib/pterodactyl/volumes', 'daemonSFTP' => 2022, 'daemonListen' => 8080, 'upload_size' => 100,
        ])->assertCreated();

        $node = Node::query()->where('name', 'Node A')->firstOrFail();

        $this->actingAs($this->admin)->postJson("/api/admin/nodes/{$node->id}/allocations", [
            'allocation_ip' => '127.0.0.1', 'allocation_alias' => 'play.example.com', 'allocation_ports' => ['25565-25569'],
        ])->assertNoContent();

        $this->actingAs($this->admin)->getJson("/api/admin/nodes/{$node->id}/allocations")
            ->assertOk()
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('ips.0', '127.0.0.1');

        $allocation = Allocation::query()->where('node_id', $node->id)->firstOrFail();
        $this->actingAs($this->admin)->patchJson("/api/admin/nodes/{$node->id}/allocations/{$allocation->id}", ['alias' => 'mc.example.com'])->assertNoContent();
        $this->assertSame('mc.example.com', $allocation->refresh()->ip_alias);

        $allocation->update(['server_id' => $this->createServerModel(['node_id' => $node->id])->id]);
        $this->actingAs($this->admin)->postJson("/api/admin/nodes/{$node->id}/allocations/delete", ['ip' => '127.0.0.1'])
            ->assertOk()
            ->assertJsonPath('skipped', 1)->assertJsonPath('deleted', 4);

        $this->actingAs($this->admin)->getJson('/api/admin/nodes')->assertOk()->assertJsonPath('data.0.usage.servers', 1);
        $this->actingAs($this->admin)->getJson("/api/admin/nodes/{$node->id}")->assertOk()->assertJsonPath('allocations.assigned', 2);
        $this->actingAs($this->admin)->getJson("/api/admin/nodes/{$node->id}/configuration?deploy=1")
            ->assertOk()
            ->assertJsonPath('deploy_command', fn ($value) => str_contains($value, "--node {$node->id}"))
            ->assertJsonPath('install_command', fn ($value) => str_contains($value, 'githubusercontent.com/brocker96/raptor-panel/0.x_beta/wings.sh) --panel-url') && str_contains($value, "--node {$node->id} --fqdn {$node->fqdn}"));
        $this->actingAs($this->admin)->getJson("/api/admin/nodes/{$node->id}/system")->assertOk()->assertJsonPath('online', false);
    }

    public function testLocationsMountsAndSettings(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/locations', ['short' => 'eu1', 'long' => 'Europe'])->assertCreated();
        $location = Location::query()->where('short', 'eu1')->firstOrFail();
        $this->actingAs($this->admin)->patchJson("/api/admin/locations/{$location->id}", ['short' => 'eu2', 'long' => 'Europe'])->assertOk()->assertJsonPath('short', 'eu2');
        $this->actingAs($this->admin)->getJson('/api/admin/locations')->assertOk()->assertJsonPath('data.0.short', 'eu2');

        $this->actingAs($this->admin)->postJson('/api/admin/mounts', [
            'name' => 'Shared maps', 'source' => '/srv/maps', 'target' => '/home/container/maps', 'read_only' => true, 'user_mountable' => false,
        ])->assertCreated();
        $mount = Mount::query()->where('name', 'Shared maps')->firstOrFail();
        $egg = Egg::query()->firstOrFail();
        $node = Node::factory()->create(['location_id' => $location->id]);
        $this->actingAs($this->admin)->putJson("/api/admin/mounts/{$mount->id}/relations", ['eggs' => [$egg->id], 'nodes' => [$node->id]])->assertNoContent();
        $this->actingAs($this->admin)->getJson("/api/admin/mounts/{$mount->id}")->assertOk()->assertJsonPath('eggs.0.id', $egg->id)->assertJsonPath('nodes.0.id', $node->id);

        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertOk()->assertJsonStructure(['general', 'mail', 'advanced', 'meta' => ['languages']]);
        $this->actingAs($this->admin)->patchJson('/api/admin/settings/general', ['app:name' => 'My Raptor', 'app:locale' => 'en', 'raptor:auth:2fa_required' => 1])->assertNoContent();
        $this->assertDatabaseHas('settings', ['key' => 'settings::app:name', 'value' => 'My Raptor']);
        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertJsonPath('general.raptor:support:enabled', 'false');

        $this->actingAs($this->admin)->patchJson('/api/admin/settings/general', ['app:name' => 'My Raptor', 'app:locale' => 'en', 'raptor:auth:2fa_required' => 1, 'raptor:support:enabled' => 'true', 'raptor:support:mail' => 'false'])->assertNoContent();
        $this->assertDatabaseHas('settings', ['key' => 'settings::raptor:support:enabled', 'value' => 'true']);
        $this->actingAs($this->admin)->patchJson('/api/admin/settings/general', ['app:name' => 'My Raptor', 'app:locale' => 'en', 'raptor:auth:2fa_required' => 1, 'raptor:support:enabled' => 'maybe'])->assertUnprocessable();
    }

    public function testApiKeys(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/admin/api-keys', [
            'memo' => 'Billing integration', 'r_servers' => 3, 'r_users' => 1, 'allowed_ips' => ['10.0.0.0/8'],
        ])->assertCreated();

        $identifier = $response->json('key.identifier');
        $this->assertSame(ApiKey::IDENTIFIER_LENGTH + ApiKey::KEY_LENGTH, strlen($response->json('token')));
        $this->assertSame(['10.0.0.0/8'], $response->json('key.allowed_ips'));

        $this->actingAs($this->admin)->postJson('/api/admin/api-keys', ['memo' => 'x', 'allowed_ips' => ['nope']])->assertUnprocessable();

        $this->actingAs($this->admin)->getJson('/api/admin/api-keys')->assertOk()->assertJsonPath('data.0.permissions.servers', 3);
        $this->actingAs($this->admin)->deleteJson("/api/admin/api-keys/{$identifier}")->assertNoContent();
        $this->assertDatabaseMissing('api_keys', ['identifier' => $identifier]);
    }

    public function testNestsAndEggs(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/nests', ['name' => 'Custom', 'description' => 'Mine'])->assertCreated();
        $nest = Nest::query()->where('name', 'Custom')->firstOrFail();

        $response = $this->actingAs($this->admin)->postJson('/api/admin/eggs', [
            'nest_id' => $nest->id,
            'name' => 'Hello',
            'docker_images' => "Alpine|ghcr.io/pterodactyl/yolks:alpine\nghcr.io/pterodactyl/yolks:debian",
            'startup' => './start.sh',
            'config_stop' => '^C',
            'config_startup' => '{"done":"Ready"}',
            'config_logs' => '{}',
            'config_files' => '{}',
        ])->assertCreated();

        $id = $response->json('id');
        $this->assertSame(['Alpine' => 'ghcr.io/pterodactyl/yolks:alpine', 'ghcr.io/pterodactyl/yolks:debian' => 'ghcr.io/pterodactyl/yolks:debian'], $response->json('docker_images'));

        $variable = $this->actingAs($this->admin)->postJson("/api/admin/eggs/{$id}/variables", [
            'name' => 'Greeting', 'env_variable' => 'GREETING', 'default_value' => 'hi', 'rules' => 'required|string', 'options' => ['user_viewable'],
        ])->assertCreated()->json('id');

        $this->actingAs($this->admin)->patchJson("/api/admin/eggs/{$id}/variables/{$variable}", [
            'name' => 'Greeting', 'env_variable' => 'GREETING', 'default_value' => 'hello', 'rules' => 'required|string', 'options' => ['user_viewable', 'user_editable'],
        ])->assertOk()->assertJsonPath('user_editable', true);

        $this->actingAs($this->admin)->patchJson("/api/admin/eggs/{$id}/script", [
            'script_install' => 'echo hi', 'script_is_privileged' => true, 'script_entry' => 'bash', 'script_container' => 'alpine:3.20',
        ])->assertOk()->assertJsonPath('script.install', 'echo hi');

        $export = $this->actingAs($this->admin)->get("/api/admin/eggs/{$id}/export")->assertOk()->getContent();
        $this->assertStringContainsString('GREETING', $export);

        $file = UploadedFile::fake()->createWithContent('egg.json', $export);
        $this->actingAs($this->admin)->post('/api/admin/eggs/import', ['import_file' => $file, 'import_to_nest' => $nest->id], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('name', 'Hello');

        $this->actingAs($this->admin)->getJson('/api/admin/nests')->assertOk()->assertJsonPath('data.' . (Nest::query()->count() - 1) . '.eggs.0.name', 'Hello');

        $this->actingAs($this->admin)->deleteJson("/api/admin/eggs/{$id}/variables/{$variable}")->assertNoContent();
        $this->actingAs($this->admin)->deleteJson("/api/admin/eggs/{$id}")->assertNoContent();
    }

    public function testActivityLog(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/locations', ['short' => 'us1', 'long' => 'US'])->assertCreated();

        $this->actingAs($this->admin)->getJson('/api/admin/activity?scope=admin')
            ->assertOk()
            ->assertJsonPath('data.0.event', 'admin:location.create')
            ->assertJsonPath('data.0.actor.username', $this->admin->username)
            ->assertJsonPath('data.0.subjects.0.type', 'location');

        $this->actingAs($this->admin)->getJson('/api/admin/activity/events')->assertOk()->assertJsonPath('data.0', 'admin:location.create');
        $this->actingAs($this->admin)->getJson('/api/admin/system/failed-jobs')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function testCloudflareSettings(): void
    {
        Node::factory()->create(['location_id' => Location::factory()->create()->id, 'fqdn' => '104.16.0.10', 'scheme' => 'https', 'daemonListen' => 8080]);

        $this->actingAs($this->admin)->getJson('/api/admin/settings/cloudflare', ['CF-Ray' => '8a1b2c3d4e5f-FRA'])
            ->assertOk()
            ->assertJsonPath('settings.trust_proxies', true)
            ->assertJsonPath('request.via_cloudflare', true)
            ->assertJsonPath('nodes.0.proxied', true)
            ->assertJsonPath('nodes.0.issues.0.level', 'error');

        $this->actingAs($this->admin)->patchJson('/api/admin/settings/cloudflare', ['trust_proxies' => false, 'websocket_keepalive' => true])->assertOk();
        $this->assertDatabaseHas('settings', ['key' => 'settings::raptor:cloudflare:trust_proxies', 'value' => 'false']);

        Http::fake([
            'www.cloudflare.com/ips-v4' => Http::response(implode("\n", array_slice(Cloudflare::DEFAULT_RANGES, 0, 15))),
            'www.cloudflare.com/ips-v6' => Http::response(implode("\n", array_slice(Cloudflare::DEFAULT_RANGES, 15))),
        ]);
        $this->actingAs($this->admin)->postJson('/api/admin/settings/cloudflare/ranges')->assertOk()->assertJsonCount(count(Cloudflare::DEFAULT_RANGES), 'list');
    }

    public function testMailDriverCanBeSwitchedBetweenSmtpAndLog(): void
    {
        config()->set('mail.default', 'smtp');

        $this->actingAs($this->admin)->putJson('/api/admin/settings/mail/driver', ['driver' => 'log'])->assertNoContent();
        $this->assertDatabaseHas('settings', ['key' => 'settings::mail:default', 'value' => 'log']);
        $this->actingAs($this->admin)->putJson('/api/admin/settings/mail/driver', ['driver' => 'mailgun'])->assertUnprocessable();

        config()->set('mail.default', 'mailgun');
        $this->actingAs($this->admin)->putJson('/api/admin/settings/mail/driver', ['driver' => 'smtp'])->assertStatus(400);

        config()->set('mail.default', 'smtp');
        config()->set('mail.mailers.smtp.host', 'smtp.example.com');
        $checks = collect($this->actingAs($this->admin)->getJson('/api/admin/system')->json('checks'))->keyBy('key');
        $this->assertFalse($checks['mail']['ok']);
    }

    public function testFailedJobTimestampsIncludeThePanelTimezone(): void
    {
        config()->set('app.timezone', 'Europe/Moscow');
        \Illuminate\Support\Facades\DB::table('failed_jobs')->insert([
            'uuid' => 'b9b3d4f2-0000-4000-8000-000000000000', 'connection' => 'redis', 'queue' => 'standard',
            'payload' => '{"displayName":"Raptor\\\\Notifications\\\\AccountCreated"}', 'exception' => "Boom\nTrace", 'failed_at' => '2026-10-27 12:00:00',
        ]);

        $this->actingAs($this->admin)->getJson('/api/admin/system/failed-jobs')
            ->assertOk()
            ->assertJsonPath('data.0.failed_at', '2026-10-27T12:00:00+03:00')
            ->assertJsonPath('data.0.job', 'AccountCreated');

        \Illuminate\Support\Facades\DB::table('failed_jobs')->delete();
    }
}
