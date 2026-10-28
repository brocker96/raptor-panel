<?php

namespace Raptor\Http\Middleware;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Raptor\Services\Security\SessionManager;

/**
 * Connects browser sessions to their user_sessions record: signs remembered devices back in,
 * signs out sessions that were ended from another device or went idle, and records activity.
 */
class TrackUserSession
{
    public function __construct(private SessionManager $sessions)
    {
    }

    public function handle(Request $request, \Closure $next): mixed
    {
        if (!$request->hasSession()) {
            return $next($request);
        }

        $guard = Auth::guard('web');
        if (!$guard->check()) {
            $this->sessions->restore($request);

            return $next($request);
        }

        $user = $guard->user();
        $session = $this->sessions->current($request);

        // Sessions created before tracking existed (or restored through Laravel's own remember
        // cookie) get a record now, so they show up in the list and can be ended as well.
        if (!$session) {
            $session = $this->sessions->start($user, $request, false, $guard->viaRemember() ? 'remember' : 'session');
        }

        if ($session->user_id !== $user->getAuthIdentifier() || !$session->isActive() || $this->sessions->isIdle($session)) {
            if ($session->isActive()) {
                $this->sessions->revoke($session, 'idle');
            }

            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $this->sessions->forgetDevice();

            if ($request->expectsJson() || Str::startsWith($request->path(), 'api/')) {
                return new JsonResponse([
                    'errors' => [[
                        'code' => 'SessionEnded',
                        'status' => '401',
                        'detail' => __('Your session has ended, please sign in again.'),
                    ]],
                ], 401);
            }

            return redirect()->route('auth.login');
        }

        $this->sessions->touch($session, $request);

        return $next($request);
    }
}
