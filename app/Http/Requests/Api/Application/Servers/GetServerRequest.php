<?php

namespace Raptor\Http\Requests\Api\Application\Servers;

use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class GetServerRequest extends ApplicationApiRequest
{
    protected ?string $resource = AdminAcl::RESOURCE_SERVERS;

    protected int $permission = AdminAcl::READ;
}
