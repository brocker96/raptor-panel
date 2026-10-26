<?php

namespace Raptor\Repositories\Eloquent;

use Raptor\Models\RecoveryToken;

class RecoveryTokenRepository extends EloquentRepository
{
    public function model(): string
    {
        return RecoveryToken::class;
    }
}
