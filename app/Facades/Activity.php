<?php

namespace Raptor\Facades;

use Illuminate\Support\Facades\Facade;
use Raptor\Services\Activity\ActivityLogService;

class Activity extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return ActivityLogService::class;
    }
}
