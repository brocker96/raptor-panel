<?php

namespace Raptor\Tests\Integration\Api\Admin;

use Raptor\Models\User;
use Raptor\Models\Setting;
use Raptor\Models\UserSession;
use Illuminate\Support\Facades\Notification;
use Raptor\Tests\Integration\IntegrationTestCase;
use Raptor\Services\Security\SecurityConfirmation;

class SecurityAdminTest extends IntegrationTestCase
{
    private User $admin;

    public function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->admin = User::factory()->create(['root_admin' => true]);
        $this->withHeader('Referer', 'http://localhost/');
    }

    protected function tearDown(): void
    {
        Setting::query()->where('key', 'like', 'settings::raptor:security:%')->delete();

        parent::tearDown();
    }

    private function confirmed(): self
    {
        return $this->actingAs($this->admin)->withSession([SecurityConfirmation::CONFIRMED_AT => time(), SecurityConfirmation::CONFIRMED_METHOD => 'password']);
    }

    private function securitySettings(array $overrides = []): array
    {
        return array_merge([
            'raptor:security:session_days' => 30,
            'raptor:security:idle_timeout' => 0,
            'raptor:security:confirm_window' => 10,
            'raptor:security:confirm_admin' => 'true',
            'raptor:security:lockout_attempts' => 10,
            'raptor:security:lockout_minutes' => 15,
            'raptor:security:alerts' => 'true',
            'raptor:security:passkeys' => 'true',
            'raptor:security:trusted_device_days' => 30,
            'raptor:security:admin_allowlist' => '',
            'raptor:security:password_min_length' => 8,
            'raptor:security:screen_lock_max' => 0,
        ], $overrides);
    }

    public function testAdminChangesRequireConfirmation(): void
    {
        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertOk()->assertJsonPath('security.raptor:security:session_days', 30);

        $this->actingAs($this->admin)->patchJson('/api/admin/settings/security', $this->securitySettings())
            ->assertForbidden()
            ->assertJsonPath('errors.0.code', 'SecurityConfirmationRequired');

        $this->confirmed()->patchJson('/api/admin/settings/security', $this->securitySettings(['raptor:security:session_days' => 7]))
            ->assertNoContent();
        $this->assertSame('7', Setting::query()->where('key', 'settings::raptor:security:session_days')->value('value'));
    }

    public function testTheAllowlistCannotLockOutTheCurrentAdministrator(): void
    {
        $this->confirmed()->patchJson('/api/admin/settings/security', $this->securitySettings(['raptor:security:admin_allowlist' => 'not-an-ip']))
            ->assertStatus(400);

        $this->confirmed()->patchJson('/api/admin/settings/security', $this->securitySettings(['raptor:security:admin_allowlist' => '203.0.113.0/24']))
            ->assertStatus(400)
            ->assertJsonPath('errors.0.detail', fn (string $detail) => str_contains($detail, 'lock you out'));

        $this->confirmed()->patchJson('/api/admin/settings/security', $this->securitySettings(['raptor:security:admin_allowlist' => "127.0.0.1\n10.0.0.0/8"]))
            ->assertNoContent();
        $this->assertSame('127.0.0.1, 10.0.0.0/8', Setting::query()->where('key', 'settings::raptor:security:admin_allowlist')->value('value'));
    }

    public function testTheAllowlistBlocksOtherAddresses(): void
    {
        config()->set('raptor.security.admin_allowlist', '203.0.113.10');

        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertForbidden();

        config()->set('raptor.security.admin_allowlist', '127.0.0.0/8');
        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertOk();
    }

    public function testAdministratorsCanSecureAnotherAccount(): void
    {
        $user = User::factory()->create([
            'security_pin' => password_hash('482916', PASSWORD_DEFAULT),
            'locked_until' => now()->addMinutes(10),
        ]);
        UserSession::query()->create([
            'user_id' => $user->id,
            'identifier' => 'cccccccc-0000-4000-8000-000000000000',
            'ip' => '198.51.100.7',
            'last_active_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $this->actingAs($this->admin)->getJson("/api/admin/users/{$user->id}")
            ->assertOk()
            ->assertJsonPath('security.pin', true)
            ->assertJsonCount(1, 'security.sessions');

        $this->confirmed()->postJson("/api/admin/users/{$user->id}/security/sessions/revoke")->assertOk()->assertJsonPath('revoked', 1);
        $this->confirmed()->deleteJson("/api/admin/users/{$user->id}/security/pin")->assertNoContent();
        $this->confirmed()->postJson("/api/admin/users/{$user->id}/security/unlock")->assertNoContent();

        $user->refresh();
        $this->assertNull($user->security_pin);
        $this->assertNull($user->locked_until);
        $this->assertSame(0, $user->securitySessions()->active()->count());
    }
}
