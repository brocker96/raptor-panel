<?php

namespace Raptor\Services\Security;

use Carbon\CarbonImmutable;
use Raptor\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Models\UserTrustedDevice;
use Illuminate\Support\Facades\Cookie;

/**
 * Browsers on which the user chose "trust this device" at the two-factor checkpoint. Signing in
 * on them only asks for the password until the trust expires or is removed.
 */
class TrustedDevices
{
    public const COOKIE = 'raptor_trusted';

    public function days(): int
    {
        return max(0, (int) config('raptor.security.trusted_device_days', 30));
    }

    public function enabled(): bool
    {
        return $this->days() > 0;
    }

    public function trust(User $user, Request $request): void
    {
        if (!$this->enabled()) {
            return;
        }

        $token = Str::random(64);

        UserTrustedDevice::query()->create([
            'user_id' => $user->id,
            'token' => hash('sha256', $token),
            'ip' => $request->ip() ?? '0.0.0.0',
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'last_used_at' => CarbonImmutable::now(),
            'expires_at' => CarbonImmutable::now()->addDays($this->days()),
        ]);

        Cookie::queue(Cookie::make(self::COOKIE, $token, $this->days() * 1440, null, null, null, true, false, 'lax'));
    }

    public function isTrusted(User $user, Request $request): bool
    {
        $token = $request->cookie(self::COOKIE);
        if (!$this->enabled() || !is_string($token) || strlen($token) !== 64) {
            return false;
        }

        /** @var UserTrustedDevice|null $device */
        $device = UserTrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('token', hash('sha256', $token))
            ->where('expires_at', '>', CarbonImmutable::now())
            ->first();

        if (!$device) {
            return false;
        }

        $device->forceFill(['last_used_at' => CarbonImmutable::now(), 'ip' => $request->ip() ?? $device->ip])->save();

        return true;
    }

    public function forgetAll(User $user): void
    {
        UserTrustedDevice::query()->where('user_id', $user->id)->delete();
    }
}
