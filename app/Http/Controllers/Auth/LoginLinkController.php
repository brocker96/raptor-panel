<?php

namespace Raptor\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\RedirectResponse;
use Raptor\Http\Controllers\Controller;
use Raptor\Services\RaptorApi\Accounts;
use Raptor\Services\Security\SessionManager;

/**
 * Opens a sign in link made with the Raptor API. Links work once and for a few minutes.
 * Accounts with two-factor authentication still sign in the normal way, a link from the shop
 * must not skip their second factor.
 */
class LoginLinkController extends Controller
{
    public function __invoke(Request $request, string $token, Accounts $accounts, SessionManager $sessions): RedirectResponse
    {
        $link = $accounts->consume($token);
        if (!$link) {
            return redirect('/auth/login');
        }

        [$user, $redirect] = $link;
        if ($user->use_totp || $user->locked_until?->isFuture()) {
            return redirect('/auth/login');
        }

        $guard = Auth::guard('web');
        if ($guard->check()) {
            $guard->logout();
        }
        $request->session()->invalidate();
        $request->session()->regenerate();

        $guard->login($user);
        $sessions->start($user, $request, false, 'link');

        Activity::event('auth:login-link')->subject($user)->actor($user)->log();

        return redirect($redirect);
    }
}
