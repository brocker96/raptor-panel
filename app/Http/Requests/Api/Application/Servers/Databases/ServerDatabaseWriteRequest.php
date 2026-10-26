<?php

namespace Raptor\Http\Requests\Api\Application\Servers\Databases;

use Raptor\Services\Acl\Api\AdminAcl;

class ServerDatabaseWriteRequest extends GetServerDatabasesRequest
{
    protected int $permission = AdminAcl::WRITE;
}
