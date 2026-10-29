<?php

namespace Raptor\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\JsonResponse;
use Raptor\Exceptions\DisplayException;
use Raptor\Services\Security\AccountLockout;
use Raptor\Services\Security\WebAuthn\WebAuthn;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Passwordless sign in with a passkey. A passkey proves possession of the device and, through the
 * required user verification, the fingerprint, face or device PIN of the user, so it replaces both
 * the password and the two-factor checkpoint.
 */
class PasskeyLoginController extends AbstractLoginController
{
    public function options(Request $request, WebAuthn $webauthn): JsonResponse
    {
        $this->ensureEnabled();

        return new JsonResponse(['data' => $webauthn->assertionOptions($request, 'login')]);
    }

    public function authenticate(Request $request, WebAuthn $webauthn, AccountLockout $lockout): JsonResponse
    {
        $this->ensureEnabled();

        if ($this->hasTooManyLoginAttempts($request)) {
            $this->fireLockoutEvent($request);
            $this->sendLockoutResponse($request);
        }

        $data = $request->validate([
            'credential' => ['required', 'array'],
            'credential.id' => ['required', 'string', 'max:1400'],
            'credential.response' => ['required', 'array'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        try {
            $passkey = $webauthn->verifyAssertion($request, $data['credential'], 'login');
        } catch (DisplayException $exception) {
            $this->incrementLoginAttempts($request);

            throw $exception;
        }

        $user = $passkey->user;
        if ($lockout->isLocked($user)) {
            throw new DisplayException(__('This account is temporarily locked after too many failed sign-in attempts. Try again after :time.', ['time' => $user->locked_until->toTimeString('minute')]));
        }

        Activity::event('auth:passkey')->withRequestMetadata()->subject($user)->property('name', $passkey->name)->log();

        $request->session()->put('auth_remember', $request->boolean('remember', true));

        return $this->sendLoginResponse($user, $request, 'passkey');
    }

    private function ensureEnabled(): void
    {
        if (!config('raptor.security.passkeys')) {
            throw new NotFoundHttpException();
        }
    }
}
