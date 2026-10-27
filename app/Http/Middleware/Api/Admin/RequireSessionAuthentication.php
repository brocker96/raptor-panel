<?php

namespace Raptor\Http\Middleware\Api\Admin;

use Illuminate\Http\Request;
use Laravel\Sanctum\TransientToken;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class RequireSessionAuthentication
{
    /**
     * The admin API powers the administrative area of the Panel and is only reachable from a
     * logged-in browser session. Application API keys have their own, more granular, permission
     * system and must keep using the "/api/application" endpoints so that a key with limited
     * permissions can never reach functionality that it was not granted.
     */
    public function handle(Request $request, \Closure $next): mixed
    {
        /** @var \Raptor\Models\User|null $user */
        $user = $request->user();
        if (!$user || !$user->root_admin || !$user->currentAccessToken() instanceof TransientToken) {
            throw new AccessDeniedHttpException('The admin API is only available to administrators using the Panel interface.');
        }

        return $next($request);
    }
}
