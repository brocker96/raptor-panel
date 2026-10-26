<?php

namespace Raptor\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Raptor\Models\Node;
use Raptor\Models\ApiKey;
use Illuminate\Http\JsonResponse;
use Raptor\Http\Controllers\Controller;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Services\Api\KeyCreationService;

class NodeAutoDeployController extends Controller
{
    /**
     * NodeAutoDeployController constructor.
     */
    public function __construct(
        private Encrypter $encrypter,
        private KeyCreationService $keyCreationService,
    ) {
    }

    /**
     * Generates a new API key for the logged-in user with read and write permission
     * to nodes, and returns that as the deployment key for a node.
     *
     * @throws \Raptor\Exceptions\Model\DataValidationException
     */
    public function __invoke(Request $request, Node $node): JsonResponse
    {
        $key = ApiKey::query()
            ->where('user_id', $request->user()->id)
            ->where('key_type', ApiKey::TYPE_APPLICATION)
            ->where('r_nodes', 3)
            ->first();

        // We couldn't find a key that exists for this user with read and write
        // permission for nodes. Go ahead and create it now.
        if (!$key) {
            $key = $this->keyCreationService->setKeyType(ApiKey::TYPE_APPLICATION)->handle([
                'user_id' => $request->user()->id,
                'memo' => 'Automatically generated node deployment key.',
                'allowed_ips' => [],
            ], ['r_nodes' => 3]);
        }

        return new JsonResponse([
            'node' => $node->id,
            'token' => $key->identifier . $this->encrypter->decrypt($key->token),
        ]);
    }
}
