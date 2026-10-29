<?php

namespace Raptor\Services\RaptorApi;

use Raptor\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Raptor\Services\Users\UserUpdateService;
use Raptor\Services\Users\UserCreationService;

/**
 * Users as a billing system sees them: found by its own id or e-mail, created on first order,
 * and sent to the Panel with a one time sign in link instead of a second password.
 */
class Accounts
{
    public function __construct(private UserCreationService $creation, private UserUpdateService $update)
    {
    }

    /**
     * Finds the user by external_id, then e-mail, and creates them when neither matches.
     * Returns the user and whether it was created.
     *
     * @return array{0: User, 1: bool}
     *
     * @throws \Throwable
     */
    public function upsert(array $data, bool $welcomeEmail = true): array
    {
        $data['email'] = Str::lower(trim($data['email']));
        $user = null;
        if (!empty($data['external_id'])) {
            $user = User::query()->where('external_id', $data['external_id'])->first();
        }
        $user ??= User::query()->where('email', $data['email'])->first();

        $fields = array_filter([
            'external_id' => $data['external_id'] ?? null,
            'email' => $data['email'],
            'name_first' => $data['first_name'] ?? null,
            'name_last' => $data['last_name'] ?? null,
            'language' => $data['language'] ?? null,
        ], fn ($value) => $value !== null);

        if ($user) {
            // The billing system is the source of truth for the fields it sends.
            if (!empty($data['password'])) {
                $fields['password'] = $data['password'];
            }
            $this->update->handle($user, $fields);

            return [$user->refresh(), false];
        }

        $user = $this->creation->handle($fields + [
            'username' => $data['username'] ?? $this->username($data['email']),
            'name_first' => $data['first_name'] ?? Str::before($data['email'], '@'),
            // The Panel requires a last name, shops often only collect one name.
            'name_last' => $data['last_name'] ?? '-',
            'password' => $data['password'] ?? null,
            'root_admin' => false,
        ], $welcomeEmail);

        return [$user, true];
    }

    /**
     * A free username from the e-mail address: "Jane.Doe+shop@x.io" becomes "jane.doe", then
     * "jane.doe2" and so on.
     */
    public function username(string $email): string
    {
        $base = Str::lower(preg_replace('/[^a-z0-9_.-]+/i', '', Str::before(Str::before($email, '@'), '+')));
        $base = trim($base, '._-');
        $base = strlen($base) < 3 ? 'user' . $base : substr($base, 0, 40);

        $candidate = $base;
        for ($i = 2; User::query()->where('username', $candidate)->exists(); ++$i) {
            $candidate = $base . $i;
        }

        return $candidate;
    }

    /**
     * A link that signs the user in once and opens the given Panel page.
     *
     * @return array{url: string, expires_at: string}
     */
    public function loginLink(User $user, ?string $redirect = null): array
    {
        $token = Str::random(64);
        $minutes = (int) config('raptor.raptor_api.login_link_minutes', 5);

        Cache::put(self::cacheKey($token), ['user' => $user->id, 'redirect' => self::safePath($redirect)], now()->addMinutes($minutes));

        return ['url' => url('/auth/link/' . $token), 'expires_at' => now()->addMinutes($minutes)->toAtomString()];
    }

    /**
     * Uses up a link. Returns the user and the page to open, or null when the link is unknown,
     * used or expired.
     *
     * @return array{0: User, 1: string}|null
     */
    public function consume(string $token): ?array
    {
        $data = Cache::pull(self::cacheKey($token));
        $user = is_array($data) ? User::query()->find($data['user']) : null;

        return $user ? [$user, $data['redirect']] : null;
    }

    /**
     * Only paths inside the Panel, so a link can never send somebody to another site.
     */
    public static function safePath(?string $path): string
    {
        $path = '/' . ltrim((string) $path, '/');

        return preg_match('#^/[A-Za-z0-9/_\-.?=&%]*$#', $path) && !str_starts_with($path, '//') ? $path : '/';
    }

    private static function cacheKey(string $token): string
    {
        return 'raptor:login-link:' . hash('sha256', $token);
    }
}
