<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Network;

use Raptor\Models\Permission;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class NewAllocationRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_ALLOCATION_CREATE;
    }
}
