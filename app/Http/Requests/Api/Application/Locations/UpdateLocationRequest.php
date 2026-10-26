<?php

namespace Raptor\Http\Requests\Api\Application\Locations;

use Raptor\Models\Location;

class UpdateLocationRequest extends StoreLocationRequest
{
    /**
     * Rules to validate this request against.
     */
    public function rules(): array
    {
        $locationId = $this->route()->parameter('location')->id; // @phpstan-ignore property.nonObject

        return collect(Location::getRulesForUpdate($locationId))->only([
            'short',
            'long',
        ])->toArray();
    }
}
