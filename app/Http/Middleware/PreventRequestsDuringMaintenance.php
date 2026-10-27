<?php

namespace Raptor\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance as Middleware;

class PreventRequestsDuringMaintenance extends Middleware
{
    /**
     * The admin area keeps following the progress of an update while the Panel is down.
     */
    protected $except = [
        'api/admin/updates/status',
    ];
}
