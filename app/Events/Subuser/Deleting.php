<?php

namespace Raptor\Events\Subuser;

use Raptor\Events\Event;
use Raptor\Models\Subuser;
use Illuminate\Queue\SerializesModels;

class Deleting extends Event
{
    use SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(public Subuser $subuser)
    {
    }
}
