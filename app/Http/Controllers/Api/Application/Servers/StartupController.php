<?php

namespace Raptor\Http\Controllers\Api\Application\Servers;

use Raptor\Models\User;
use Raptor\Models\Server;
use Raptor\Services\Servers\StartupModificationService;
use Raptor\Transformers\Api\Application\ServerTransformer;
use Raptor\Http\Controllers\Api\Application\ApplicationApiController;
use Raptor\Http\Requests\Api\Application\Servers\UpdateServerStartupRequest;

class StartupController extends ApplicationApiController
{
    /**
     * StartupController constructor.
     */
    public function __construct(private StartupModificationService $modificationService)
    {
        parent::__construct();
    }

    /**
     * Update the startup and environment settings for a specific server.
     *
     * @throws \Illuminate\Validation\ValidationException
     * @throws \Raptor\Exceptions\Http\Connection\DaemonConnectionException
     * @throws \Raptor\Exceptions\Model\DataValidationException
     * @throws \Raptor\Exceptions\Repository\RecordNotFoundException
     */
    public function index(UpdateServerStartupRequest $request, Server $server): array
    {
        $server = $this->modificationService
            ->setUserLevel(User::USER_LEVEL_ADMIN)
            ->handle($server, $request->validated());

        return $this->fractal->item($server)
            ->transformWith($this->getTransformer(ServerTransformer::class))
            ->toArray();
    }
}
