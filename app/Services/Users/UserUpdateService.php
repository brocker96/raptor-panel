<?php

namespace Raptor\Services\Users;

use Raptor\Models\User;
use Raptor\Events\User\PasswordChanged;
use Illuminate\Contracts\Hashing\Hasher;
use Raptor\Traits\Services\HasUserLevels;

class UserUpdateService
{
    use HasUserLevels;

    /**
     * UserUpdateService constructor.
     */
    public function __construct(private Hasher $hasher)
    {
    }

    /**
     * Update the user model instance and return the updated model.
     *
     * @throws \Throwable
     */
    public function handle(User $user, array $data): User
    {
        if (!empty(array_get($data, 'password'))) {
            $data['password'] = $this->hasher->make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->forceFill($data)->saveOrFail();

        if (isset($data['password'])) {
            PasswordChanged::dispatch($user);
        }

        return $user->refresh();
    }
}
