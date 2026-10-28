<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Restricts the admin area to the addresses configured in Settings → Security. An empty list
 * allows every address.
 */
class AdminIpAllowlist
{
    public function handle(Request $request, \Closure $next): mixed
    {
        $ranges = self::ranges((string) config('raptor.security.admin_allowlist', ''));

        if (!empty($ranges) && !IpUtils::checkIp((string) $request->ip(), $ranges)) {
            throw new AccessDeniedHttpException(__('The admin area cannot be opened from your IP address (:ip).', ['ip' => $request->ip()]));
        }

        return $next($request);
    }

    /**
     * @return string[]
     */
    public static function ranges(string $value): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $value) ?: [])));
    }
}
