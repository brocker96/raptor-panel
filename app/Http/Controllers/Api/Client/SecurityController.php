<?php

namespace Raptor\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Raptor\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\UserPasskey;
use Raptor\Models\UserSession;
use Illuminate\Validation\Rule;
use Raptor\Models\RecoveryToken;
use Illuminate\Http\JsonResponse;
use Raptor\Models\UserTrustedDevice;
use Raptor\Exceptions\DisplayException;
use Raptor\Notifications\SecurityAlert;
use Raptor\Services\Security\ScreenLock;
use Raptor\Services\Security\SessionManager;
use Raptor\Services\Security\TrustedDevices;
use Raptor\Services\Security\UserAgentParser;
use Raptor\Services\Security\SecurityNotifier;
use Raptor\Services\Security\WebAuthn\WebAuthn;
use Raptor\Services\Security\SecurityConfirmation;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Everything on the Security page of an account: sessions, trusted devices, passkeys, the PIN,
 * the screen lock, recovery codes and re-confirmation of sensitive actions.
 */
class SecurityController extends ClientApiController
{
    private const LOGIN_EVENTS = ['auth:success', 'auth:fail', 'auth:checkpoint', 'auth:passkey', 'auth:account-locked'];

    public function __construct(
        private SessionManager $sessions,
        private SecurityConfirmation $confirmation,
        private ScreenLock $screenLock,
        private TrustedDevices $trustedDevices,
        private SecurityNotifier $notifier,
        private WebAuthn $webauthn,
    ) {
        parent::__construct();
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $current = $this->sessions->current($request);

        $sessions = $user->securitySessions()->active()->orderByDesc('last_active_at')->get()
            ->map(fn (UserSession $session) => [
                'identifier' => $session->identifier,
                'current' => $current?->id === $session->id,
                'ip' => $session->ip,
                'method' => $session->method,
                'remember' => $session->remember,
                'created_at' => $session->created_at->toAtomString(),
                'last_active_at' => $session->last_active_at?->toAtomString(),
                'expires_at' => $session->expires_at?->toAtomString(),
            ] + $session->device())
            ->sortByDesc('current')->values();

        $logins = $user->activity()
            ->whereIn('activity_logs.event', self::LOGIN_EVENTS)
            ->reorder('activity_logs.timestamp', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($log) => [
                'event' => $log->event,
                'ip' => $log->ip,
                'timestamp' => $log->timestamp->toAtomString(),
            ] + UserAgentParser::parse($log->properties['useragent'] ?? null));

        return new JsonResponse([
            'two_factor' => [
                'enabled' => $user->use_totp,
                'recovery_codes' => $user->use_totp ? $user->recoveryTokens()->count() : 0,
            ],
            'pin' => [
                'enabled' => !empty($user->security_pin),
                'set_at' => $user->security_pin_set_at?->toAtomString(),
                'locked' => $this->confirmation->pinLocked($user),
            ],
            'screen_lock' => [
                'minutes' => $user->screen_lock_minutes,
                'effective' => $this->screenLock->minutes($user),
                'max' => (int) config('raptor.security.screen_lock_max', 0) ?: null,
                'choices' => ScreenLock::CHOICES,
            ],
            'alerts' => $user->security_alerts,
            'passkeys' => $user->passkeys()->orderBy('created_at')->get()->map(fn (UserPasskey $key) => [
                'id' => $key->id,
                'name' => $key->name,
                'transports' => $key->transports ?? [],
                'created_at' => $key->created_at->toAtomString(),
                'last_used_at' => $key->last_used_at?->toAtomString(),
            ]),
            'sessions' => $sessions,
            'trusted_devices' => $user->trustedDevices()->where('expires_at', '>', now())->orderByDesc('last_used_at')->get()
                ->map(fn (UserTrustedDevice $device) => [
                    'id' => $device->id,
                    'ip' => $device->ip,
                    'created_at' => $device->created_at->toAtomString(),
                    'last_used_at' => $device->last_used_at?->toAtomString(),
                    'expires_at' => $device->expires_at->toAtomString(),
                ] + $device->device()),
            'logins' => $logins,
            'policy' => [
                'passkeys' => (bool) config('raptor.security.passkeys'),
                'trusted_device_days' => $this->trustedDevices->days(),
                'confirm_window' => $this->confirmation->window(),
                'session_days' => $this->sessions->sessionDays(),
                'idle_timeout' => (int) config('raptor.security.idle_timeout', 0),
                'two_factor_required' => (int) config('raptor.auth.2fa_required', 0),
            ],
        ]);
    }

    /**
     * State used by the lock screen and the confirmation dialog. Allowed while the screen is locked.
     */
    public function state(Request $request): JsonResponse
    {
        return new JsonResponse([
            'locked' => $this->screenLock->isLocked($request),
            'screen_lock_minutes' => $this->screenLock->minutes($request->user()),
            'confirmed' => $this->confirmation->isConfirmed($request),
            'methods' => $this->confirmation->methods($request->user()),
        ]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'string', Rule::in(['password', 'pin', 'totp', 'passkey'])],
            'value' => ['required_unless:method,passkey', 'nullable', 'string', 'max:512'],
            'credential' => ['required_if:method,passkey', 'array'],
        ]);

        if ($data['method'] === 'passkey') {
            $passkey = $this->webauthn->verifyAssertion($request, $data['credential'], 'confirm', $request->user());
            $this->confirmation->markConfirmed($request, 'passkey');
            Activity::event('user:security.confirmed')->property(['method' => 'passkey', 'name' => $passkey->name])->log();
        } else {
            $this->confirmation->confirm($request, $data['method'], (string) $data['value']);
            Activity::event('user:security.confirmed')->property('method', $data['method'])->log();
        }

        return new JsonResponse(['confirmed_until' => Carbon::now()->addMinutes($this->confirmation->window())->toAtomString()]);
    }

    public function confirmPasskeyOptions(Request $request): JsonResponse
    {
        $this->ensurePasskeys();

        return new JsonResponse(['data' => $this->webauthn->assertionOptions($request, 'confirm', $request->user())]);
    }

    public function lock(Request $request): Response
    {
        $this->screenLock->lock($request);

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function unlock(Request $request): Response
    {
        $data = $request->validate([
            'method' => ['required', Rule::in(['pin', 'password'])],
            'value' => ['required', 'string', 'max:512'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $valid = $data['method'] === 'pin'
            ? $this->confirmation->verifyPin($user, $data['value'])
            : password_verify($data['value'], $user->password);

        if (!$valid) {
            Activity::event('user:security.unlock-failed')->property('method', $data['method'])->log();

            throw new DisplayException($data['method'] === 'pin' ? ($this->confirmation->pinLocked($user) ? __('Too many wrong PIN attempts. Unlock with your password instead.') : __('The PIN is not correct.')) : __('The password is not correct.'));
        }

        if ($data['method'] === 'password') {
            $this->confirmation->resetPinAttempts($user);
        }

        $this->screenLock->unlock($request);

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function updatePin(Request $request): Response
    {
        $data = $request->validate([
            'pin' => ['required', 'string', 'regex:/^\d{4,8}$/', function ($attribute, $value, $fail) {
                if (count(array_unique(str_split($value))) === 1 || str_contains('0123456789', $value) || str_contains('9876543210', $value)) {
                    $fail(__('Choose a PIN that is harder to guess than repeated or consecutive digits.'));
                }
            }],
        ], ['pin.regex' => __('The PIN must be 4 to 8 digits.')]);

        /** @var User $user */
        $user = $request->user();
        $user->forceFill([
            'security_pin' => password_hash($data['pin'], PASSWORD_DEFAULT),
            'security_pin_set_at' => Carbon::now(),
        ])->save();
        $this->confirmation->resetPinAttempts($user);

        Activity::event('user:security.pin-updated')->log();
        $this->notifier->notify($user, SecurityAlert::PIN_CHANGED, $request);

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function deletePin(Request $request): Response
    {
        $request->user()->forceFill(['security_pin' => null, 'security_pin_set_at' => null])->save();

        Activity::event('user:security.pin-removed')->log();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function updatePreferences(Request $request): Response
    {
        $data = $request->validate([
            'screen_lock_minutes' => ['sometimes', 'nullable', 'integer', Rule::in(ScreenLock::CHOICES)],
            'security_alerts' => ['sometimes', 'boolean'],
        ]);

        $request->user()->forceFill($data)->save();

        if (array_key_exists('screen_lock_minutes', $data)) {
            $request->session()->put(ScreenLock::LAST_SEEN, time());
        }

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function revokeSession(Request $request, string $identifier): Response
    {
        /** @var UserSession|null $session */
        $session = $request->user()->securitySessions()->where('identifier', $identifier)->first();
        if (!$session) {
            throw new NotFoundHttpException();
        }

        $this->sessions->revoke($session);

        Activity::event('user:security.session-revoked')->property(['ip' => $session->ip] + $session->device())->log();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function revokeOtherSessions(Request $request): JsonResponse
    {
        $count = $this->sessions->revokeOthers($request->user(), $this->sessions->current($request));

        Activity::event('user:security.sessions-revoked')->property('count', $count)->log();

        return new JsonResponse(['revoked' => $count]);
    }

    public function forgetTrustedDevice(Request $request, int $id): Response
    {
        $deleted = $request->user()->trustedDevices()->where('id', $id)->delete();
        if (!$deleted) {
            throw new NotFoundHttpException();
        }

        Activity::event('user:security.trusted-device-removed')->log();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function forgetTrustedDevices(Request $request): Response
    {
        $this->trustedDevices->forgetAll($request->user());

        Activity::event('user:security.trusted-device-removed')->property('all', true)->log();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function passkeyOptions(Request $request): JsonResponse
    {
        $this->ensurePasskeys();

        return new JsonResponse(['data' => $this->webauthn->registrationOptions($request, $request->user())]);
    }

    public function storePasskey(Request $request): JsonResponse
    {
        $this->ensurePasskeys();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'credential' => ['required', 'array'],
            'credential.response' => ['required', 'array'],
        ]);

        /** @var User $user */
        $user = $request->user();
        if ($user->passkeys()->count() >= 20) {
            throw new DisplayException(__('You can register at most 20 passkeys.'));
        }

        $attributes = $this->webauthn->verifyRegistration($request, $data['credential']);

        /** @var UserPasskey $passkey */
        $passkey = $user->passkeys()->create(['name' => trim($data['name'])] + $attributes);

        Activity::event('user:security.passkey-added')->property('name', $passkey->name)->log();
        $this->notifier->notify($user, SecurityAlert::PASSKEY_ADDED, $request, $passkey->name);

        return new JsonResponse(['id' => $passkey->id, 'name' => $passkey->name], Response::HTTP_CREATED);
    }

    public function renamePasskey(Request $request, int $id): Response
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:64']]);

        $passkey = $request->user()->passkeys()->findOrFail($id);
        $passkey->forceFill(['name' => trim($data['name'])])->save();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function deletePasskey(Request $request, int $id): Response
    {
        $passkey = $request->user()->passkeys()->findOrFail($id);
        $passkey->delete();

        Activity::event('user:security.passkey-removed')->property('name', $passkey->name)->log();

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (!$user->use_totp) {
            throw new DisplayException(__('Enable two-step verification first.'));
        }

        $tokens = [];
        $inserts = [];
        for ($i = 0; $i < 10; ++$i) {
            $tokens[] = $token = Str::random(10);
            $inserts[] = ['user_id' => $user->id, 'token' => password_hash($token, PASSWORD_DEFAULT), 'created_at' => Carbon::now()];
        }

        RecoveryToken::query()->where('user_id', $user->id)->delete();
        RecoveryToken::query()->insert($inserts);

        Activity::event('user:security.recovery-codes')->log();
        $this->notifier->notify($user, SecurityAlert::RECOVERY_CODES, $request);

        return new JsonResponse(['tokens' => $tokens]);
    }

    private function ensurePasskeys(): void
    {
        if (!config('raptor.security.passkeys')) {
            throw new DisplayException(__('Passkeys are disabled on this Panel.'));
        }
    }
}
