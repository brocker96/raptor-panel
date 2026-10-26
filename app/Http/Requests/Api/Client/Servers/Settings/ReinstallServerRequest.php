<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Settings;

use Raptor\Models\Permission;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class ReinstallServerRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_REINSTALL;
    }
}
