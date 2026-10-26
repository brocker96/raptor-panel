<?php

namespace Raptor\Http\Requests\Api\Client\Servers\Backups;

use Raptor\Models\Permission;
use Raptor\Http\Requests\Api\Client\ClientApiRequest;

class RestoreBackupRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_BACKUP_RESTORE;
    }

    public function rules(): array
    {
        return ['truncate' => 'required|boolean'];
    }
}
