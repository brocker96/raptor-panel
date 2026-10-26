<?php

namespace Raptor\Facades;

use Illuminate\Support\Facades\Facade;
use Raptor\Services\Activity\ActivityLogBatchService;

class LogBatch extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return ActivityLogBatchService::class;
    }
}
