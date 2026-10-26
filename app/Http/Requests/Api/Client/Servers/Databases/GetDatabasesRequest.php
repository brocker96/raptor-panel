<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Databases;

use Raptor\Models\Permission;
use Raptor\Contracts\Http\ClientPermissionsRequest;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class GetDatabasesRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_DATABASE_READ;
    }
}
