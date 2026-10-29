<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\ApiKey;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Raptor\Models\RaptorWebhook;
use Raptor\Models\ServerPackage;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Services\Api\KeyCreationService;
use Illuminate\Contracts\Encryption\Encrypter;

/**
 * Admin → Raptor API: what a billing system needs to connect, and a key made for it.
 */
class RaptorApiController extends AdminApiController
{
    /** What a billing key may do: everything the Raptor API offers, nothing beyond it. */
    private const BILLING_PERMISSIONS = [
        'r_servers' => AdminAcl::READ | AdminAcl::WRITE,
        'r_users' => AdminAcl::READ | AdminAcl::WRITE,
        'r_nodes' => AdminAcl::READ,
        'r_locations' => AdminAcl::READ,
        'r_eggs' => AdminAcl::READ,
        'r_nests' => AdminAcl::READ,
        'r_allocations' => AdminAcl::READ,
    ];

    public function index(): JsonResponse
    {
        $keys = ApiKey::query()->where('key_type', ApiKey::TYPE_APPLICATION)->orderByDesc('id')->get();

        return new JsonResponse([
            'base_url' => url('/api/raptor/v1'),
            'docs_url' => 'https://github.com/brocker96/raptor-panel/blob/0.x_beta/docs/raptor-api.md',
            'events' => RaptorWebhook::EVENTS,
            'packages' => ServerPackage::query()->count(),
            'webhooks' => RaptorWebhook::query()->count(),
            'keys' => $keys->map(fn (ApiKey $key) => [
                'identifier' => $key->identifier,
                'memo' => $key->memo,
                'billing' => AdminAcl::check($key, AdminAcl::RESOURCE_SERVERS, AdminAcl::WRITE) && AdminAcl::check($key, AdminAcl::RESOURCE_USERS, AdminAcl::WRITE),
                'last_used_at' => $key->last_used_at?->toAtomString(),
                'created_at' => $key->created_at?->toAtomString(),
            ]),
        ]);
    }

    /**
     * One click key for a billing system. The token is shown once.
     */
    public function createKey(Request $request, KeyCreationService $creation, Encrypter $encrypter): JsonResponse
    {
        $data = $request->validate([
            'memo' => 'required|string|max:500',
            'allowed_ips' => 'sometimes|array|max:50',
            'allowed_ips.*' => 'ip',
        ]);

        $key = $creation->setKeyType(ApiKey::TYPE_APPLICATION)->handle([
            'memo' => $data['memo'],
            'user_id' => $request->user()->id,
            'allowed_ips' => array_values(array_unique($data['allowed_ips'] ?? [])),
        ], self::BILLING_PERMISSIONS);

        Activity::event('admin:api-key.create')->subject($key)->property('identifier', $key->identifier)->log();

        return new JsonResponse([
            'identifier' => $key->identifier,
            'token' => $key->identifier . $encrypter->decrypt($key->token),
        ], 201);
    }
}
