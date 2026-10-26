<?php

namespace Raptor\Contracts\Core;

use Raptor\Events\Event;

interface ReceivesEvents
{
    /**
     * Handles receiving an event from the application.
     */
    public function handle(Event $notification): void;
}
