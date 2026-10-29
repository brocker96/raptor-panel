<?php

namespace Raptor\Services\Security;

use Raptor\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Models\UserSession;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;

/**
 * Keeps track of every signed in browser of a user.
 *
 * Laravel's "remember me" uses one token per user, so a single remembered device can never be
 * signed out on its own. Raptor Panel instead gives each device its own token (stored hashed in
 * user_sessions) and keeps the identifier of the record in the session, which allows a user to
 * see all of their sessions and end any of them.
 */
class SessionManager
{
    public const SESSION_KEY = 'security.session';
    public const DEVICE_COOKIE = 'raptor_device';

    /**
     * Minimum seconds between two "last active" updates of the same session.
     */
    private const TOUCH_INTERVAL = 60;

    /**
     * Starts tracking a new session for the user that just signed in.
     */
    public function start(User $user, Request $request, bool $remember, string $method = 'password'): UserSession
    {
        $token = $remember ? Str::random(64) : null;

        $session = UserSession::query()->create([
            'user_id' => $user->id,
            'identifier' => Str::uuid()->toString(),
            'device_token' => $token ? hash('sha256', $token) : null,
            'remember' => $remember,
            'method' => $method,
            'ip' => $request->ip() ?? '0.0.0.0',
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'last_active_at' => CarbonImmutable::now(),
            'expires_at' => $this->expiresAt($remember),
        ]);

        $request->session()->put(self::SESSION_KEY, $session->identifier);

        if ($token) {
            Cookie::queue(Cookie::make(self::DEVICE_COOKIE, $token, $this->sessionDays() * 1440, null, null, null, true, false, 'lax'));
        }

        return $session;
    }

    /**
     * Returns the tracked session of the current request, if there is one.
     */
    public function current(Request $request): ?UserSession
    {
        if (!$request->hasSession() || !($identifier = $request->session()->get(self::SESSION_KEY))) {
            return null;
        }

        return UserSession::query()->where('identifier', $identifier)->first();
    }

    /**
     * Signs a guest back in using the device cookie of a remembered session.
     */
    public function restore(Request $request): ?User
    {
        $token = $request->cookie(self::DEVICE_COOKIE);
        if (!is_string($token) || strlen($token) !== 64) {
            return null;
        }

        /** @var UserSession|null $session */
        $session = UserSession::query()->active()->where('device_token', hash('sha256', $token))->first();
        if (!$session || !$session->user) {
            Cookie::queue(Cookie::forget(self::DEVICE_COOKIE));

            return null;
        }

        if ($this->isIdle($session)) {
            $this->revoke($session, 'idle');

            return null;
        }

        Auth::guard('web')->login($session->user);
        $request->session()->regenerate();
        $request->session()->put(self::SESSION_KEY, $session->identifier);

        $this->touch($session, $request, true);

        return $session->user;
    }

    /**
     * Records activity of the session, at most once a minute.
     */
    public function touch(UserSession $session, Request $request, bool $force = false): void
    {
        if (!$force && $session->last_active_at && $session->last_active_at->diffInSeconds(now(), true) < self::TOUCH_INTERVAL) {
            return;
        }

        $session->forceFill([
            'ip' => $request->ip() ?? $session->ip,
            'last_active_at' => CarbonImmutable::now(),
            'expires_at' => $this->expiresAt($session->remember),
        ])->save();
    }

    public function isIdle(UserSession $session): bool
    {
        $minutes = (int) config('raptor.security.idle_timeout');

        return $minutes > 0 && $session->last_active_at && $session->last_active_at->addMinutes($minutes)->isPast();
    }

    /**
     * Ends a session. The browser using it is signed out on its next request.
     */
    public function revoke(UserSession $session, string $reason = 'revoked'): void
    {
        if (!is_null($session->revoked_at)) {
            return;
        }

        $session->forceFill([
            'revoked_at' => CarbonImmutable::now(),
            'revoked_reason' => $reason,
            'device_token' => null,
        ])->save();

        $this->cycleRememberToken($session->user);
    }

    /**
     * Ends every session of the user except the given one. Returns the number of ended sessions.
     */
    public function revokeOthers(User $user, ?UserSession $except = null, string $reason = 'revoked'): int
    {
        $count = UserSession::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->when($except, fn ($query) => $query->where('id', '!=', $except->id))
            ->update([
                'revoked_at' => CarbonImmutable::now(),
                'revoked_reason' => $reason,
                'device_token' => null,
            ]);

        $this->cycleRememberToken($user);

        return $count;
    }

    /**
     * Logs the current browser out and forgets its device cookie.
     */
    public function forgetDevice(): void
    {
        Cookie::queue(Cookie::forget(self::DEVICE_COOKIE));
    }

    public function sessionDays(): int
    {
        return max(1, (int) config('raptor.security.session_days', 30));
    }

    private function expiresAt(bool $remember): CarbonImmutable
    {
        return $remember
            ? CarbonImmutable::now()->addDays($this->sessionDays())
            : CarbonImmutable::now()->addMinutes((int) config('session.lifetime', 720));
    }

    /**
     * Laravel's own remember cookie (used by installations before session tracking existed)
     * would sign an ended session straight back in, changing the token invalidates it.
     */
    private function cycleRememberToken(?User $user): void
    {
        if (!$user) {
            return;
        }

        $user->setRememberToken(Str::random(60));
        $user->timestamps = false;
        $user->saveQuietly();
        $user->timestamps = true;
    }
}
