<?php

namespace Raptor\Http\Requests\Api\Application\Locations;

use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class DeleteLocationRequest extends ApplicationApiRequest
{
    protected ?string $resource = AdminAcl::RESOURCE_LOCATIONS;

    protected int $permission = AdminAcl::WRITE;
}
