<?php

namespace Raptor\Repositories\Eloquent;

use Raptor\Models\User;
use Raptor\Contracts\Repository\UserRepositoryInterface;

class UserRepository extends EloquentRepository implements UserRepositoryInterface
{
    /**
     * Return the model backing this repository.
     */
    public function model(): string
    {
        return User::class;
    }
}
