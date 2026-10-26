<?php

namespace Raptor\Events\Auth;

use Raptor\Models\User;
use Raptor\Events\Event;

class DirectLogin extends Event
{
    public function __construct(public User $user, public bool $remember)
    {
    }
}
