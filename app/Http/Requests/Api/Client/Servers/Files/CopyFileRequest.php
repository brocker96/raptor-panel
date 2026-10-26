<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Files;

use Raptor\Models\Permission;
use Raptor\Contracts\Http\ClientPermissionsRequest;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class CopyFileRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_CREATE;
    }

    public function rules(): array
    {
        return [
            'location' => 'required|string',
        ];
    }
}
