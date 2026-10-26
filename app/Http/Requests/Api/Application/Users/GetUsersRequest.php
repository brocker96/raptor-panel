<?php

namespace Raptor\Http\Requests\Api\Application\Users;

use Raptor\Services\Acl\Api\AdminAcl as Acl;
use Raptor\Http\Requests\Api\Application\ApplicationApiRequest;

class GetUsersRequest extends ApplicationApiRequest
{
    protected ?string $resource = Acl::RESOURCE_USERS;

    protected int $permission = Acl::READ;
}
