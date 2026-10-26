<?php

namespace Raptor\Http\Requests\Api\Application\Nodes;

use Raptor\Services\Acl\Api\AdminAcl;

class GetNodeConfigurationRequest extends GetNodesRequest
{
    protected int $permission = AdminAcl::WRITE;
}
