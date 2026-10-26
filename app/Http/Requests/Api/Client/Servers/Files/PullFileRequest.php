<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Files;

use Raptor\Models\Permission;
use Raptor\Contracts\Http\ClientPermissionsRequest;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class PullFileRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_CREATE;
    }

    public function rules(): array
    {
        return [
            'url' => 'required|string|url',
            'directory' => 'nullable|string',
            'filename' => 'nullable|string',
            'use_header' => 'boolean',
            'foreground' => 'boolean',
        ];
    }
}
