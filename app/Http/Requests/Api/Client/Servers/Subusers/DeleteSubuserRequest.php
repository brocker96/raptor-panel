<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Subusers;

use Raptor\Models\Permission;

class DeleteSubuserRequest extends SubuserRequest
{
    public function permission(): string
    {
        return Permission::ACTION_USER_DELETE;
    }
}
