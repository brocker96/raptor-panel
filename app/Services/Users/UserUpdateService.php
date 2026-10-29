<?php

namespace Raptor\Services\Users;

use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Jobs\RevokeSftpAccessJob;
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

        $wasAdmin = (bool) $user->getOriginal('root_admin');

        $user->forceFill($data)->saveOrFail();

        if (isset($data['password'])) {
            PasswordChanged::dispatch($user);
        }

        if ($wasAdmin && !$user->root_admin) {
            // A former admin may still hold SFTP sessions on servers they no longer have
            // any access to, so end them everywhere.
            Node::query()->each(fn (Node $node) => RevokeSftpAccessJob::dispatch($user->uuid, $node));
        }

        return $user->refresh();
    }
}
