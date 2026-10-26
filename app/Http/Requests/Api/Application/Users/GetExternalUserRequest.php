<?php

namespace Raptor\Http\Requests\Api\Application\Users;

use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class GetExternalUserRequest extends ApplicationApiRequest
{
    protected ?string $resource = AdminAcl::RESOURCE_USERS;

    protected int $permission = AdminAcl::READ;
}
