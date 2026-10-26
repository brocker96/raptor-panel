<?php

namespace Raptor\Http\Requests\Api\Application\Nodes;

use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class DeleteNodeRequest extends ApplicationApiRequest
{
    protected ?string $resource = AdminAcl::RESOURCE_NODES;

    protected int $permission = AdminAcl::WRITE;
}
