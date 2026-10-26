<?php

namespace Raptor\Http\Controllers\Api\Application\Servers;

use Raptor\Models\Server;
use Raptor\Transformers\Api\Application\ServerTransformer;
use Raptor\Http\Controllers\Api\Application\ApplicationApiController;
use Raptor\Http\Requests\Api\Application\Servers\GetExternalServerRequest;

class ExternalServerController extends ApplicationApiController
{
    /**
     * Retrieve a specific server from the database using its external ID.
     */
    public function index(GetExternalServerRequest $request, string $external_id): array
    {
        $server = Server::query()->where('external_id', $external_id)->firstOrFail();

        return $this->fractal->item($server)
            ->transformWith($this->getTransformer(ServerTransformer::class))
            ->toArray();
    }
}
