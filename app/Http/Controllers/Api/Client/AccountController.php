<?php

namespace Raptor\Http\Controllers\Api\Client;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Http\Response;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Raptor\Facades\Activity;
use Illuminate\Support\Facades\RateLimiter;
use Raptor\Services\Users\UserUpdateService;
use Raptor\Transformers\Api\Client\AccountTransformer;
use Raptor\Http\Requests\Api\Client\Account\UpdateEmailRequest;
use Raptor\Http\Requests\Api\Client\Account\UpdatePasswordRequest;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class AccountController extends ClientApiController
{
    /**
     * The number of seconds that must elapse before the email change throttle resets.
     */
    private const EMAIL_UPDATE_THROTTLE = 60 * 60 * 24;

    /**
     * AccountController constructor.
     */
    public function __construct(private AuthManager $manager, private UserUpdateService $updateService)
    {
        parent::__construct();
    }

    public function index(Request $request): array
    {
        return $this->fractal->item($request->user())
            ->transformWith($this->getTransformer(AccountTransformer::class))
            ->toArray();
    }

    /**
     * Update the interface language of the authenticated user, null follows the Panel default.
     */
    public function updateLanguage(Request $request): Response
    {
        $data = $request->validate([
            'language' => ['present', 'nullable', 'string', Rule::in(array_keys(User::LANGUAGES))],
        ]);

        $original = $request->user()->language;
        $request->user()->forceFill(['language' => $data['language']])->saveOrFail();

        if ($original !== $data['language']) {
            Activity::event('user:account.language-changed')
                ->property(['old' => $original, 'new' => $data['language']])
                ->log();
        }

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's email address.
     */
    public function updateEmail(UpdateEmailRequest $request): JsonResponse
    {
        $user = $request->user();
        // Only allow a user to change their email three times in the span
        // of 24 hours. This prevents malicious users from trying to find
        // existing accounts in the system by constantly changing their email.
        if (RateLimiter::tooManyAttempts($key = "user:update-email:{$user->uuid}", 3)) {
            throw new TooManyRequestsHttpException(message: 'Your email address has been changed too many times today. Please try again later.');
        }

        $original = $user->email;
        if (mb_strtolower($original) !== mb_strtolower($request->validated('email'))) {
            RateLimiter::hit($key, self::EMAIL_UPDATE_THROTTLE);

            $this->updateService->handle($user, $request->validated());

            Activity::event('user:account.email-changed')
                ->property(['old' => $original, 'new' => $request->validated('email')])
                ->log();
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's password. All existing sessions will be logged
     * out immediately.
     *
     * @throws \Throwable
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = Activity::event('user:account.password-changed')->transaction(function () use ($request) {
            return $this->updateService->handle($request->user(), $request->validated());
        });

        $guard = $this->manager->guard();
        // If you do not update the user in the session you'll end up working with a
        // cached copy of the user that does not include the updated password. Do this
        // to correctly store the new user details in the guard and allow the logout
        // other devices functionality to work.
        $guard->setUser($user);

        // This method doesn't exist in the stateless Sanctum world.
        if (method_exists($guard, 'logoutOtherDevices')) { // @phpstan-ignore function.alreadyNarrowedType
            $guard->logoutOtherDevices($request->input('password'));
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }
}
