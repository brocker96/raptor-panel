<?php

namespace Raptor\Http\Controllers\Api\Application\Servers;

use Raptor\Models\Server;
use Raptor\Services\Servers\BuildModificationService;
use Raptor\Services\Servers\DetailsModificationService;
use Raptor\Transformers\Api\Application\ServerTransformer;
use Raptor\Http\Controllers\Api\Application\ApplicationApiController;
use Raptor\Http\Requests\Api\Application\Servers\UpdateServerDetailsRequest;
use Raptor\Http\Requests\Api\Application\Servers\UpdateServerBuildConfigurationRequest;

class ServerDetailsController extends ApplicationApiController
{
    /**
     * ServerDetailsController constructor.
     */
    public function __construct(
        private BuildModificationService $buildModificationService,
        private DetailsModificationService $detailsModificationService,
    ) {
        parent::__construct();
    }

    /**
     * Update the details for a specific server.
     *
     * @throws \Raptor\Exceptions\DisplayException
     * @throws \Raptor\Exceptions\Model\DataValidationException
     * @throws \Raptor\Exceptions\Repository\RecordNotFoundException
     */
    public function details(UpdateServerDetailsRequest $request, Server $server): array
    {
        $updated = $this->detailsModificationService->returnUpdatedModel()->handle(
            $server,
            $request->validated()
        );

        return $this->fractal->item($updated)
            ->transformWith($this->getTransformer(ServerTransformer::class))
            ->toArray();
    }

    /**
     * Update the build details for a specific server.
     *
     * @throws \Raptor\Exceptions\DisplayException
     * @throws \Raptor\Exceptions\Model\DataValidationException
     * @throws \Raptor\Exceptions\Repository\RecordNotFoundException
     */
    public function build(UpdateServerBuildConfigurationRequest $request, Server $server): array
    {
        $server = $this->buildModificationService->handle($server, $request->validated());

        return $this->fractal->item($server)
            ->transformWith($this->getTransformer(ServerTransformer::class))
            ->toArray();
    }
}
