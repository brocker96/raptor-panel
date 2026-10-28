<?php

namespace Raptor\Services\Security;

use Raptor\Models\User;
use Illuminate\Http\Request;

/**
 * The screen lock hides the panel after a period of inactivity until the user enters their PIN
 * (or password). The lock is stored in the session, so reloading the page or calling the API
 * directly does not get around it.
 */
class ScreenLock
{
    public const LOCKED = 'security.locked';
    public const LAST_SEEN = 'security.last_seen';

    public const CHOICES = [5, 10, 15, 30, 60];

    /**
     * Minutes of inactivity after which the screen locks, null when it never locks.
     */
    public function minutes(User $user): ?int
    {
        $max = (int) config('raptor.security.screen_lock_max', 0);
        $minutes = $user->screen_lock_minutes ?: null;

        if ($max > 0) {
            return min($minutes ?? $max, $max);
        }

        return $minutes;
    }

    public function isLocked(Request $request): bool
    {
        return (bool) $request->session()->get(self::LOCKED, false);
    }

    public function lock(Request $request): void
    {
        $request->session()->put(self::LOCKED, true);

        // Whoever unlocks the screen has to confirm sensitive actions again.
        $request->session()->forget([SecurityConfirmation::CONFIRMED_AT, SecurityConfirmation::CONFIRMED_METHOD]);
    }

    public function unlock(Request $request): void
    {
        $request->session()->put(self::LOCKED, false);
        $request->session()->put(self::LAST_SEEN, time());
    }

    /**
     * Locks the session when the browser was away for longer than allowed (for example a closed
     * laptop), and records the current request as activity otherwise.
     */
    public function check(Request $request, User $user): bool
    {
        if ($this->isLocked($request)) {
            return true;
        }

        $minutes = $this->minutes($user);
        $lastSeen = $request->session()->get(self::LAST_SEEN);
        if ($minutes && is_int($lastSeen) && $lastSeen + $minutes * 60 < time()) {
            $this->lock($request);

            return true;
        }

        $request->session()->put(self::LAST_SEEN, time());

        return false;
    }
}
