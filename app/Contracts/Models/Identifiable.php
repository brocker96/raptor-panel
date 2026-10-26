<?php

namespace Raptor\Contracts\Models;

use Illuminate\Database\Eloquent\Builder;

interface Identifiable
{
    public function scopeWhereIdentifier(Builder $builder, string $identifier): void;
}
