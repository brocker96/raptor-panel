<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Security\SecurityConfirmation;

/**
 * Asks the browser to confirm the identity of the user again before a sensitive action. The
 * frontend catches the "SecurityConfirmationRequired" error, shows the confirmation dialog and
 * repeats the request once the user confirmed.
 *
 * Usage: ->middleware('confirm') or ->middleware('confirm:strong') for actions that change the
 * security of the account, where a PIN is not enough.
 */
class RequireSecurityConfirmation
{
    public function __construct(private SecurityConfirmation $confirmation)
    {
    }

    public function handle(Request $request, \Closure $next, ?string $level = null): mixed
    {
        if (!$this->confirmation->appliesTo($request)) {
            return $next($request);
        }

        // Changes in the admin area can be excluded from confirmation by the administrator.
        if ($level === 'admin') {
            if ($request->isMethodSafe() || !config('raptor.security.confirm_admin')) {
                return $next($request);
            }
            $level = null;
        }

        $strong = $level === 'strong';
        if ($this->confirmation->isConfirmed($request, $strong)) {
            return $next($request);
        }

        return new JsonResponse([
            'errors' => [[
                'code' => 'SecurityConfirmationRequired',
                'status' => '403',
                'detail' => __('Please confirm it is you to continue.'),
                'meta' => [
                    'methods' => $this->confirmation->methods($request->user(), $strong),
                    'strong' => $strong,
                ],
            ]],
        ], 403);
    }
}
