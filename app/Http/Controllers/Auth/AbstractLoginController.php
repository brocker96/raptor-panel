<?php

namespace Raptor\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Raptor\Models\User;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Auth\Events\Failed;
use Illuminate\Container\Container;
use Illuminate\Support\Facades\Event;
use Raptor\Events\Auth\DirectLogin;
use Raptor\Exceptions\DisplayException;
use Raptor\Http\Controllers\Controller;
use Raptor\Services\Security\SessionManager;
use Raptor\Notifications\SecurityAlert;
use Raptor\Services\Security\AccountLockout;
use Raptor\Services\Security\SecurityNotifier;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Auth\AuthenticatesUsers;

abstract class AbstractLoginController extends Controller
{
    use AuthenticatesUsers;

    protected AuthManager $auth;

    /**
     * Lockout time for failed login requests.
     */
    protected int $lockoutTime;

    /**
     * After how many attempts should logins be throttled and locked.
     */
    protected int $maxLoginAttempts;

    /**
     * Where to redirect users after login / registration.
     */
    protected string $redirectTo = '/';

    /**
     * LoginController constructor.
     */
    public function __construct()
    {
        $this->lockoutTime = config('auth.lockout.time');
        $this->maxLoginAttempts = config('auth.lockout.attempts');
        $this->auth = Container::getInstance()->make(AuthManager::class);
    }

    /**
     * Get the failed login response instance.
     *
     * @return never-return
     *
     * @throws DisplayException
     */
    protected function sendFailedLoginResponse(Request $request, ?Authenticatable $user = null, ?string $message = null)
    {
        $this->incrementLoginAttempts($request);
        $this->fireFailedLoginEvent($user, [
            $this->getField($request->input('user')) => $request->input('user'),
        ]);

        if ($request->route()->named('auth.login-checkpoint')) {
            throw new DisplayException($message ?? trans('auth.two_factor.checkpoint_failed'));
        }

        throw new DisplayException(trans('auth.failed'));
    }

    /**
     * Send the response after the user was authenticated.
     */
    protected function sendLoginResponse(User $user, Request $request, string $method = 'password'): JsonResponse
    {
        $remember = $request->session()->pull('auth_remember', $request->boolean('remember', true));

        $request->session()->remove('auth_confirmation_token');
        $request->session()->regenerate();

        $this->clearLoginAttempts($request);

        // Every device gets its own revocable token instead of Laravel's shared remember token.
        $this->auth->guard()->login($user);
        $session = Container::getInstance()->make(SessionManager::class)->start($user, $request, (bool) $remember, $method);

        Container::getInstance()->make(AccountLockout::class)->succeeded($user);

        $notifier = Container::getInstance()->make(SecurityNotifier::class);
        if ($notifier->isNewDevice($user, $request, $session)) {
            $notifier->notify($user, SecurityAlert::NEW_SIGN_IN, $request);
        }

        Event::dispatch(new DirectLogin($user, true));

        return new JsonResponse([
            'data' => [
                'complete' => true,
                'intended' => $this->redirectPath(),
                'user' => $user->toVueObject(),
            ],
        ]);
    }

    /**
     * Determine if the user is logging in using an email or username.
     */
    protected function getField(?string $input = null): string
    {
        return ($input && str_contains($input, '@')) ? 'email' : 'username';
    }

    /**
     * Fire a failed login event.
     */
    protected function fireFailedLoginEvent(?Authenticatable $user = null, array $credentials = [])
    {
        Event::dispatch(new Failed('auth', $user, $credentials));
    }
}
