<?php

namespace Raptor\Events\Server;

use Raptor\Events\Event;
use Raptor\Models\Server;
use Illuminate\Queue\SerializesModels;

class Saving extends Event
{
    use SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(public Server $server)
    {
    }
}
