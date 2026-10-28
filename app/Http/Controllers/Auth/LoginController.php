<?php

namespace Raptor\Http\Controllers\Auth;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Models\User;
use Illuminate\Http\JsonResponse;
use Raptor\Facades\Activity;
use Illuminate\Contracts\View\View;
use Raptor\Exceptions\DisplayException;
use Raptor\Services\Security\AccountLockout;
use Raptor\Services\Security\TrustedDevices;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class LoginController extends AbstractLoginController
{
    /**
     * Handle all incoming requests for the authentication routes and render the
     * base authentication view component. React will take over at this point and
     * turn the login area into an SPA.
     */
    public function index(): View
    {
        return view('templates/auth.core');
    }

    /**
     * Handle a login request to the application.
     *
     * @throws \Raptor\Exceptions\DisplayException
     * @throws \Illuminate\Validation\ValidationException
     */
    public function login(Request $request): JsonResponse
    {
        if ($this->hasTooManyLoginAttempts($request)) {
            $this->fireLockoutEvent($request);
            $this->sendLockoutResponse($request);
        }

        try {
            $username = $request->input('user');

            /** @var User $user */
            $user = User::query()->where($this->getField($username), $username)->firstOrFail();
        } catch (ModelNotFoundException) {
            $this->sendFailedLoginResponse($request);
        }

        // Ensure that the account is using a valid username and password before trying to
        // continue. Previously this was handled in the 2FA checkpoint, however that has
        // a flaw in which you can discover if an account exists simply by seeing if you
        // can proceed to the next step in the login process.
        $lockout = app(AccountLockout::class);
        if (!password_verify($request->input('password'), $user->password)) {
            $lockout->failed($user, $request);
            $this->sendFailedLoginResponse($request, $user);
        }

        // Checked only after the password, so a lock does not reveal that an account exists.
        if ($lockout->isLocked($user)) {
            throw new DisplayException(__('This account is temporarily locked after too many failed sign-in attempts. Try again after :time.', [
                'time' => $user->locked_until->toTimeString('minute'),
            ]));
        }

        $request->session()->put('auth_remember', $request->boolean('remember', true));

        if (!$user->use_totp) {
            return $this->sendLoginResponse($user, $request);
        }

        if (app(TrustedDevices::class)->isTrusted($user, $request)) {
            return $this->sendLoginResponse($user, $request, 'trusted-device');
        }

        Activity::event('auth:checkpoint')->withRequestMetadata()->subject($user)->log();

        $request->session()->put('auth_confirmation_token', [
            'user_id' => $user->id,
            'token_value' => $token = Str::random(64),
            'expires_at' => CarbonImmutable::now()->addMinutes(5),
        ]);

        return new JsonResponse([
            'data' => [
                'complete' => false,
                'confirmation_token' => $token,
                'can_trust_device' => app(TrustedDevices::class)->enabled(),
                'trust_days' => app(TrustedDevices::class)->days(),
            ],
        ]);
    }
}
