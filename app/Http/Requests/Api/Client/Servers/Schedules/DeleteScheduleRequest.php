<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Schedules;

use Raptor\Models\Permission;

class DeleteScheduleRequest extends ViewScheduleRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SCHEDULE_DELETE;
    }
}
