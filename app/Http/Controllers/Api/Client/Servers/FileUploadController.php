<?php

namespace Raptor\Http\Controllers\Api\Client\Servers;

use Carbon\CarbonImmutable;
use Raptor\Models\User;
use Raptor\Enum\JwtScope;
use Raptor\Models\Server;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Nodes\NodeJWTService;
use Raptor\Http\Controllers\Api\Client\ClientApiController;
use Raptor\Http\Requests\Api\Client\Servers\Files\UploadFileRequest;

class FileUploadController extends ClientApiController
{
    /**
     * FileUploadController constructor.
     */
    public function __construct(
        private NodeJWTService $jwtService,
    ) {
        parent::__construct();
    }

    /**
     * Returns an url where files can be uploaded to.
     */
    public function __invoke(UploadFileRequest $request, Server $server): JsonResponse
    {
        return new JsonResponse([
            'object' => 'signed_url',
            'attributes' => [
                'url' => $this->getUploadUrl($server, $request->user()),
            ],
        ]);
    }

    /**
     * Returns an url where files can be uploaded to.
     */
    protected function getUploadUrl(Server $server, User $user): string
    {
        $token = $this->jwtService
            ->setExpiresAt(CarbonImmutable::now()->addMinutes(15))
            ->setUser($user)
            ->setClaims(['server_uuid' => $server->uuid])
            ->setScopes(JwtScope::FileUpload)
            ->handle($server->node, $user->id . $server->uuid);

        return sprintf(
            '%s/upload/file?token=%s',
            $server->node->getConnectionAddress(),
            $token->toString()
        );
    }
}
