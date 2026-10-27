<?php

namespace Raptor\Tests\Integration\Api\Admin;

use Raptor\Models\User;
use Raptor\Models\Setting;
use Raptor\Models\ActivityLog;
use Illuminate\Support\Facades\Http;
use Raptor\Services\Updates\Updater;
use Illuminate\Filesystem\Filesystem;
use Raptor\Services\Updates\ReleaseFeed;
use Raptor\Tests\Integration\IntegrationTestCase;

class UpdatesApiTest extends IntegrationTestCase
{
    private User $admin;

    public function setUp(): void
    {
        parent::setUp();

        $this->cleanup();
        $this->admin = User::factory()->create(['root_admin' => true]);

        config()->set('app.version', '0.2.0');
        cache()->forget(ReleaseFeed::CACHE_KEY);

        Http::fake([
            'api.github.com/repos/brocker96/raptor-panel/releases*' => Http::response([
                $this->release('v0.4.0-beta.1', prerelease: true),
                $this->release('v0.3.0'),
                $this->release('v0.2.0'),
                $this->release('v0.5.0', draft: true),
                $this->release('nightly'),
            ]),
        ]);
    }

    protected function tearDown(): void
    {
        $this->cleanup();

        parent::tearDown();
    }

    private function cleanup(): void
    {
        Setting::query()->where('key', 'like', 'settings::raptor:updates:%')->delete();
        ActivityLog::query()->delete();
        User::query()->forceDelete();
        (new Filesystem())->deleteDirectory(storage_path('app/raptor/updates'));
        app()->maintenanceMode()->deactivate();
    }

    private function release(string $tag, bool $prerelease = false, bool $draft = false): array
    {
        return [
            'tag_name' => $tag,
            'name' => "Raptor $tag",
            'prerelease' => $prerelease,
            'draft' => $draft,
            'published_at' => '2026-10-01T10:00:00Z',
            'html_url' => "https://github.com/brocker96/raptor-panel/releases/tag/$tag",
            'body' => "Notes for $tag",
            'assets' => [
                ['name' => 'panel.tar.gz', 'browser_download_url' => "https://github.com/brocker96/raptor-panel/releases/download/$tag/panel.tar.gz"],
            ],
        ];
    }

    public function testReleasesAreFilteredSortedAndMatchedAgainstTheChannel(): void
    {
        $this->actingAs($this->admin)->getJson('/api/admin/updates')
            ->assertOk()
            ->assertJsonPath('current', '0.2.0')
            ->assertJsonPath('channel', 'beta')
            ->assertJsonPath('latest.version', '0.4.0-beta.1')
            ->assertJsonPath('update_available', true)
            ->assertJsonCount(3, 'releases')
            ->assertJsonPath('releases.2.version', '0.2.0');

        $this->actingAs($this->admin)->putJson('/api/admin/updates/channel', ['channel' => 'stable', 'auto_check' => false])
            ->assertOk()
            ->assertJsonPath('latest.version', '0.3.0')
            ->assertJsonPath('auto_check', false);
        $this->assertDatabaseHas('settings', ['key' => 'settings::raptor:updates:channel', 'value' => 'stable']);

        $this->actingAs($this->admin)->putJson('/api/admin/updates/channel', ['channel' => 'nightly'])->assertUnprocessable();

        config()->set('app.version', '0.3.0');
        $this->actingAs($this->admin)->getJson('/api/admin/updates')->assertJsonPath('update_available', false);

        config()->set('app.version', 'canary');
        $this->actingAs($this->admin)->getJson('/api/admin/updates')
            ->assertJsonPath('development', true)
            ->assertJsonPath('update_available', true);
    }

    public function testUpdatesAreQueuedOnceAndCanBeCancelled(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/updates/install', ['version' => '9.9.9'])->assertStatus(400);

        $this->actingAs($this->admin)->postJson('/api/admin/updates/install', ['version' => 'v0.3.0'])
            ->assertOk()
            ->assertJsonPath('state.status', Updater::QUEUED)
            ->assertJsonPath('state.target', '0.3.0')
            ->assertJsonPath('state.requested_by', $this->admin->username);

        $this->actingAs($this->admin)->postJson('/api/admin/updates/install', ['version' => '0.3.0'])
            ->assertStatus(400)
            ->assertJsonPath('errors.0.detail', 'Another update is already queued or running.');

        $this->actingAs($this->admin)->deleteJson('/api/admin/updates/queue')->assertNoContent();
        $this->actingAs($this->admin)->getJson('/api/admin/updates/status')->assertJsonPath('state.status', Updater::IDLE);
        $this->actingAs($this->admin)->deleteJson('/api/admin/updates/queue')->assertStatus(400);

        $this->actingAs($this->admin)->postJson('/api/admin/updates/rollback', ['backup' => '../../etc'])->assertStatus(400);
    }

    public function testStatusIsAvailableDuringMaintenanceModeOnlyForAdmins(): void
    {
        app()->maintenanceMode()->activate([]);

        $this->actingAs($this->admin)->getJson('/api/admin/updates/status')->assertOk()->assertJsonPath('version', '0.2.0');
        $this->actingAs($this->admin)->getJson('/api/admin/updates')->assertStatus(503);

        app()->maintenanceMode()->deactivate();

        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/admin/updates/status')->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/updates/install', ['version' => '0.3.0'])->assertForbidden();
    }
}
