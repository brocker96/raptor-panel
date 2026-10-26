<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Startup;

use Raptor\Models\Permission;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class GetStartupRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_STARTUP_READ;
    }
}
