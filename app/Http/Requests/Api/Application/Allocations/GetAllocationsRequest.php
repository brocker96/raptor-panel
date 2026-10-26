<?php

namespace Raptor\Http\Requests\Api\Application\Allocations;

use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class GetAllocationsRequest extends ApplicationApiRequest
{
    protected ?string $resource = AdminAcl::RESOURCE_ALLOCATIONS;

    protected int $permission = AdminAcl::READ;
}
