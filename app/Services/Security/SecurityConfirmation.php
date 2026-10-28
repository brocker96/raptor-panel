<?php

namespace Raptor\Services\Security;

use Carbon\CarbonImmutable;
use Raptor\Models\User;
use Illuminate\Http\Request;
use PragmaRX\Google2FA\Google2FA;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\TransientToken;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Exceptions\DisplayException;

/**
 * "Sudo mode": sensitive actions require the user to prove again that they are in front of the
 * browser. A successful confirmation stays valid for a few minutes (Settings → Security).
 *
 * Password, two-factor code and passkey are strong methods. The PIN is a quick method that is
 * accepted for everyday sensitive actions, but not for changing the security of the account.
 */
class SecurityConfirmation
{
    public const CONFIRMED_AT = 'security.confirmed_at';
    public const CONFIRMED_METHOD = 'security.confirmed_method';

    public const STRONG_METHODS = ['password', 'totp', 'passkey'];

    /**
     * Wrong PINs in a row before the PIN stops working until the password is used.
     */
    public const MAX_PIN_ATTEMPTS = 5;

    public function __construct(private Encrypter $encrypter, private Google2FA $google2FA)
    {
    }

    /**
     * Requests authenticated with an API key carry their own credential and never have a browser
     * session that could be confirmed.
     */
    public function appliesTo(Request $request): bool
    {
        $user = $request->user();

        return $user && $request->hasSession() && (!method_exists($user, 'currentAccessToken') || is_null($user->currentAccessToken()) || $user->currentAccessToken() instanceof TransientToken);
    }

    public function isConfirmed(Request $request, bool $strong = false): bool
    {
        $at = $request->session()->get(self::CONFIRMED_AT);
        if (!is_int($at) || $at + $this->window() * 60 < time()) {
            return false;
        }

        return !$strong || in_array($request->session()->get(self::CONFIRMED_METHOD), self::STRONG_METHODS, true);
    }

    /**
     * Methods the user can confirm with, strongest first.
     *
     * @return string[]
     */
    public function methods(User $user, bool $strong = false): array
    {
        $methods = [];
        if (config('raptor.security.passkeys') && $user->passkeys()->exists()) {
            $methods[] = 'passkey';
        }

        if ($user->use_totp) {
            $methods[] = 'totp';
        }

        $methods[] = 'password';

        if (!$strong && $user->security_pin && !$this->pinLocked($user)) {
            array_unshift($methods, 'pin');
        }

        return $methods;
    }

    /**
     * Verifies the given secret and marks the session as confirmed.
     *
     * @throws DisplayException
     */
    public function confirm(Request $request, string $method, string $value): void
    {
        /** @var User $user */
        $user = $request->user();

        $valid = match ($method) {
            'password' => password_verify($value, $user->password),
            'pin' => $this->verifyPin($user, $value),
            'totp' => $this->verifyTotp($user, $value),
            default => false,
        };

        if (!$valid) {
            throw new DisplayException(match ($method) {
                'pin' => $this->pinLocked($user)
                    ? __('Too many wrong PIN attempts. Confirm with your password instead.')
                    : __('The PIN is not correct.'),
                'totp' => __('The two-factor code is not valid.'),
                default => __('The password is not correct.'),
            });
        }

        if ($method === 'password') {
            Cache::forget($this->pinKey($user));
        }

        $this->markConfirmed($request, $method);
    }

    public function markConfirmed(Request $request, string $method): void
    {
        $request->session()->put(self::CONFIRMED_AT, time());
        $request->session()->put(self::CONFIRMED_METHOD, $method);
    }

    public function forget(Request $request): void
    {
        $request->session()->forget([self::CONFIRMED_AT, self::CONFIRMED_METHOD]);
    }

    public function window(): int
    {
        return max(1, (int) config('raptor.security.confirm_window', 10));
    }

    /**
     * Checks a PIN, counting wrong attempts. After too many the PIN is disabled until the user
     * confirms with their password.
     */
    public function verifyPin(User $user, string $pin): bool
    {
        if (!$user->security_pin || $this->pinLocked($user)) {
            return false;
        }

        if (password_verify($pin, $user->security_pin)) {
            Cache::forget($this->pinKey($user));

            return true;
        }

        Cache::put($this->pinKey($user), (int) Cache::get($this->pinKey($user), 0) + 1, CarbonImmutable::now()->addDay());

        return false;
    }

    public function pinLocked(User $user): bool
    {
        return (int) Cache::get($this->pinKey($user), 0) >= self::MAX_PIN_ATTEMPTS;
    }

    public function resetPinAttempts(User $user): void
    {
        Cache::forget($this->pinKey($user));
    }

    /**
     * Verifies a TOTP code. Codes cannot be reused within their window.
     */
    public function verifyTotp(User $user, string $code): bool
    {
        if (!$user->use_totp || !$user->totp_secret) {
            return false;
        }

        $old = $user->totp_authenticated_at
            ? (int) floor($user->totp_authenticated_at->unix() / $this->google2FA->getKeyRegeneration())
            : null;

        $verified = $this->google2FA->verifyKeyNewer(
            $this->encrypter->decrypt($user->totp_secret),
            preg_replace('/\s+/', '', $code) ?? '',
            $old,
            config('raptor.auth.2fa.window') ?? 1,
        );

        if ($verified === false) {
            return false;
        }

        $user->forceFill(['totp_authenticated_at' => CarbonImmutable::now()])->save();

        return true;
    }

    private function pinKey(User $user): string
    {
        return "security:pin-failures:{$user->id}";
    }
}
