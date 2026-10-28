<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Security\ScreenLock;
use Raptor\Services\Security\SecurityConfirmation;

/**
 * Blocks every API request of a locked session, except the ones needed to unlock it.
 */
class EnforceScreenLock
{
    private const ALLOWED = [
        'api/client/account/security/unlock',
        'api/client/account/security/state',
    ];

    public function __construct(private ScreenLock $lock, private SecurityConfirmation $confirmation)
    {
    }

    public function handle(Request $request, \Closure $next): mixed
    {
        if (!$this->confirmation->appliesTo($request) || in_array(trim($request->path(), '/'), self::ALLOWED, true)) {
            return $next($request);
        }

        // Polling requests run while the user is away and must not count as activity.
        if ($request->headers->get('X-Raptor-Background') === '1' && !$this->lock->isLocked($request)) {
            return $next($request);
        }

        if ($this->lock->check($request, $request->user())) {
            return new JsonResponse([
                'errors' => [[
                    'code' => 'ScreenLocked',
                    'status' => '423',
                    'detail' => __('The screen is locked.'),
                ]],
            ], 423);
        }

        return $next($request);
    }
}
