<?php

namespace Raptor\Transformers\Api\Application;

use Raptor\Models\Egg;
use Raptor\Models\EggVariable;

class EggVariableTransformer extends BaseTransformer
{
    /**
     * Return the resource name for the JSONAPI output.
     */
    public function getResourceName(): string
    {
        return Egg::RESOURCE_NAME;
    }

    public function transform(EggVariable $model)
    {
        return $model->toArray();
    }
}
