<?php

namespace Raptor\Tests\Integration\Api\Client;

use Raptor\Models\User;
use Raptor\Models\UserSession;
use Raptor\Notifications\SecurityAlert;
use Raptor\Services\Security\ScreenLock;
use Illuminate\Support\Facades\Notification;
use Raptor\Tests\Integration\IntegrationTestCase;
use Raptor\Services\Security\SecurityConfirmation;

/**
 * Exercises the security features through real browser style (session) requests.
 */
class AccountSecurityTest extends IntegrationTestCase
{
    public function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        config()->set('recaptcha.enabled', false);

        // Requests from the panel frontend are stateful, those are the ones these features protect.
        $this->withHeader('Referer', 'http://localhost/');
        $this->withHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36');
    }

    private function login(User $user, bool $remember = true): void
    {
        $this->postJson('/auth/login', ['user' => $user->username, 'password' => 'password', 'remember' => $remember])
            ->assertOk()
            ->assertJsonPath('data.complete', true);
    }

    public function testLoggingInCreatesATrackedSessionThatCanBeEnded(): void
    {
        $user = User::factory()->create();
        $this->login($user);

        /** @var UserSession $session */
        $session = $user->securitySessions()->sole();
        $this->assertTrue($session->remember);
        $this->assertNotNull($session->device_token);
        $this->assertSame('Chrome 131', $session->device()['browser']);

        $this->getJson('/api/client/account/security')
            ->assertOk()
            ->assertJsonPath('sessions.0.current', true)
            ->assertJsonPath('sessions.0.os', 'Windows')
            ->assertJsonPath('two_factor.enabled', false);

        // Ending the session from elsewhere signs this browser out on its next request.
        $session->forceFill(['revoked_at' => now()])->save();
        $this->getJson('/api/client/account')->assertUnauthorized()->assertJsonPath('errors.0.code', 'SessionEnded');
    }

    public function testOtherSessionsCanBeSignedOut(): void
    {
        $user = User::factory()->create();
        $other = UserSession::query()->create([
            'user_id' => $user->id,
            'identifier' => 'aaaaaaaa-0000-4000-8000-000000000000',
            'ip' => '198.51.100.7',
            'last_active_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $this->login($user);
        $this->postJson('/api/client/account/security/sessions/revoke-others')->assertOk()->assertJsonPath('revoked', 1);

        $this->assertNotNull($other->refresh()->revoked_at);
        $this->assertSame(1, $user->securitySessions()->active()->count());
    }

    public function testSensitiveActionsRequireConfirmation(): void
    {
        $user = User::factory()->create();
        $this->login($user);

        $this->postJson('/api/client/account/api-keys', ['description' => 'Test'])
            ->assertForbidden()
            ->assertJsonPath('errors.0.code', 'SecurityConfirmationRequired')
            ->assertJsonPath('errors.0.meta.methods', ['password']);

        $this->postJson('/api/client/account/security/confirm', ['method' => 'password', 'value' => 'wrong'])->assertStatus(400);
        $this->postJson('/api/client/account/security/confirm', ['method' => 'password', 'value' => 'password'])->assertOk();

        $this->postJson('/api/client/account/api-keys', ['description' => 'Test'])->assertOk();
    }

    public function testPinConfirmsEverydayActionsButNotSecurityChanges(): void
    {
        $user = User::factory()->create();
        $this->login($user);

        $this->postJson('/api/client/account/security/confirm', ['method' => 'password', 'value' => 'password'])->assertOk();
        $this->putJson('/api/client/account/security/pin', ['pin' => '1234'])->assertUnprocessable();
        $this->putJson('/api/client/account/security/pin', ['pin' => '12a4'])->assertUnprocessable();
        $this->putJson('/api/client/account/security/pin', ['pin' => '482916'])->assertNoContent();
        Notification::assertSentTo($user, SecurityAlert::class, fn (SecurityAlert $alert) => $alert->type === SecurityAlert::PIN_CHANGED);

        // A confirmation made with the PIN is not strong enough to change account security.
        $this->withSession([SecurityConfirmation::CONFIRMED_AT => null]);
        $this->postJson('/api/client/account/security/confirm', ['method' => 'pin', 'value' => '482916'])->assertOk();
        $this->postJson('/api/client/account/api-keys', ['description' => 'Test'])->assertOk();
        $this->deleteJson('/api/client/account/security/pin')
            ->assertForbidden()
            ->assertJsonPath('errors.0.meta.strong', true)
            ->assertJsonPath('errors.0.meta.methods', ['password']);
    }

    public function testThePinStopsWorkingAfterTooManyWrongAttempts(): void
    {
        $user = User::factory()->create(['security_pin' => password_hash('482916', PASSWORD_DEFAULT)]);
        $this->login($user);

        for ($i = 0; $i < SecurityConfirmation::MAX_PIN_ATTEMPTS; ++$i) {
            $this->postJson('/api/client/account/security/confirm', ['method' => 'pin', 'value' => '000000'])->assertStatus(400);
        }

        $this->postJson('/api/client/account/security/confirm', ['method' => 'pin', 'value' => '482916'])
            ->assertStatus(400)
            ->assertJsonPath('errors.0.detail', 'Too many wrong PIN attempts. Confirm with your password instead.');
    }

    public function testTheScreenLockBlocksTheApiUntilUnlocked(): void
    {
        $user = User::factory()->create(['security_pin' => password_hash('482916', PASSWORD_DEFAULT)]);
        $this->login($user);

        $this->postJson('/api/client/account/security/lock')->assertNoContent();
        $this->getJson('/api/client/account')->assertStatus(423)->assertJsonPath('errors.0.code', 'ScreenLocked');
        $this->getJson('/api/client/account/security/state')->assertOk()->assertJsonPath('locked', true);

        $this->postJson('/api/client/account/security/unlock', ['method' => 'pin', 'value' => '111111'])->assertStatus(400);
        $this->postJson('/api/client/account/security/unlock', ['method' => 'pin', 'value' => '482916'])->assertNoContent();
        $this->getJson('/api/client/account')->assertOk();
    }

    public function testTheScreenLocksAfterTheConfiguredInactivity(): void
    {
        $user = User::factory()->create(['screen_lock_minutes' => 5]);
        $this->login($user);

        $this->withSession([ScreenLock::LAST_SEEN => time() - 600]);
        $this->getJson('/api/client/account')->assertStatus(423);
    }

    public function testAccountsAreLockedAfterTooManyFailedSignIns(): void
    {
        config()->set('raptor.security.lockout_attempts', 3);
        $user = User::factory()->create();

        for ($i = 0; $i < 3; ++$i) {
            $this->postJson('/auth/login', ['user' => $user->username, 'password' => 'wrong'])->assertStatus(400);
        }

        $this->assertTrue($user->refresh()->locked_until->isFuture());
        Notification::assertSentTo($user, SecurityAlert::class, fn (SecurityAlert $alert) => $alert->type === SecurityAlert::ACCOUNT_LOCKED);

        // Even the right password is refused while the account is locked.
        $this->postJson('/auth/login', ['user' => $user->username, 'password' => 'password'])
            ->assertStatus(400)
            ->assertJsonPath('errors.0.detail', fn (string $detail) => str_contains($detail, 'temporarily locked'));
    }

    public function testSignInsFromNewDevicesAreReported(): void
    {
        $user = User::factory()->create();
        $this->login($user);
        Notification::assertNothingSent();

        $this->postJson('/auth/logout')->assertStatus(204);
        $this->withHeader('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
        $this->login($user);

        Notification::assertSentTo($user, SecurityAlert::class, fn (SecurityAlert $alert) => $alert->type === SecurityAlert::NEW_SIGN_IN);
    }

    public function testChangingThePasswordSignsOutOtherSessions(): void
    {
        $user = User::factory()->create();
        $other = UserSession::query()->create([
            'user_id' => $user->id,
            'identifier' => 'bbbbbbbb-0000-4000-8000-000000000000',
            'ip' => '198.51.100.7',
            'last_active_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $this->login($user);
        $this->putJson('/api/client/account/password', [
            'current_password' => 'password',
            'password' => 'New-password-123',
            'password_confirmation' => 'New-password-123',
        ])->assertNoContent();

        $this->assertNotNull($other->refresh()->revoked_at);
        $this->getJson('/api/client/account')->assertOk();
    }

    public function testApiKeyRequestsAreNotAskedForConfirmation(): void
    {
        $user = User::factory()->create();
        $this->withoutHeader('Referer');

        $this->actingAs($user)->postJson('/api/client/account/api-keys', ['description' => 'Test'])->assertOk();
    }
}
