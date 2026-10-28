<?php

namespace Raptor\Services\Security;

use Carbon\CarbonImmutable;
use Raptor\Models\User;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Support\Facades\Cache;
use Raptor\Notifications\SecurityAlert;

/**
 * Locks an account for a while after too many failed sign-ins, no matter from how many addresses
 * they came. This stops distributed password guessing that the per-address throttle cannot see.
 */
class AccountLockout
{
    public function __construct(private SecurityNotifier $notifier)
    {
    }

    public function isLocked(User $user): bool
    {
        return $user->locked_until && $user->locked_until->isFuture();
    }

    public function failed(User $user, Request $request): void
    {
        $attempts = (int) config('raptor.security.lockout_attempts', 10);
        $minutes = max(1, (int) config('raptor.security.lockout_minutes', 15));
        if ($attempts <= 0 || $this->isLocked($user)) {
            return;
        }

        $key = "security:login-failures:{$user->id}";
        $count = (int) Cache::get($key, 0) + 1;
        Cache::put($key, $count, CarbonImmutable::now()->addMinutes($minutes));

        if ($count < $attempts) {
            return;
        }

        Cache::forget($key);
        $user->forceFill(['locked_until' => CarbonImmutable::now()->addMinutes($minutes)])->save();

        Activity::event('auth:account-locked')->withRequestMetadata()->subject($user)->property('minutes', $minutes)->log();
        $this->notifier->notify($user, SecurityAlert::ACCOUNT_LOCKED, $request, (string) $minutes);
    }

    public function succeeded(User $user): void
    {
        Cache::forget("security:login-failures:{$user->id}");
    }

    public function unlock(User $user): void
    {
        Cache::forget("security:login-failures:{$user->id}");
        $user->forceFill(['locked_until' => null])->save();
    }
}
