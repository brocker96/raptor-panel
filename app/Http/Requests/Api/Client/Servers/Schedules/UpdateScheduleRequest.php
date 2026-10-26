<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Schedules;

use Raptor\Models\Permission;

class UpdateScheduleRequest extends StoreScheduleRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SCHEDULE_UPDATE;
    }
}
