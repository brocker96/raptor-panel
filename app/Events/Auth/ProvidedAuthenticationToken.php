<?php

namespace Raptor\Events\Auth;

use Raptor\Models\User;
use Raptor\Events\Event;

class ProvidedAuthenticationToken extends Event
{
    public function __construct(public User $user, public bool $recovery = false)
    {
    }
}
