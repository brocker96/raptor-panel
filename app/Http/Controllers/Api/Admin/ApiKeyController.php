<?php

namespace Raptor\Http\Controllers\Api\Admin;

use IPTools\Range;
use Raptor\Models\ApiKey;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Services\Api\KeyCreationService;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Http\Requests\Admin\Api\StoreApplicationApiKeyRequest;

class ApiKeyController extends AdminApiController
{
    public function __construct(private Encrypter $encrypter, private KeyCreationService $keyCreationService)
    {
    }

    /**
     * Returns every application API key on the Panel, regardless of the administrator that
     * created it, so that stale keys can be audited and revoked.
     */
    public function index(): JsonResponse
    {
        $resources = AdminAcl::getResourceList();
        sort($resources);

        $keys = ApiKey::query()
            ->with('user:id,username,email')
            ->where('key_type', ApiKey::TYPE_APPLICATION)
            ->latest('id')
            ->get()
            ->map(fn (ApiKey $key) => $this->format($key, $resources));

        return new JsonResponse(['data' => $keys, 'resources' => $resources]);
    }

    public function store(StoreApplicationApiKeyRequest $request): JsonResponse
    {
        $request->validate([
            'allowed_ips' => 'sometimes|array|max:50',
            'allowed_ips.*' => ['string', function (string $attribute, mixed $value, \Closure $fail) {
                try {
                    $valid = Range::parse($value)->valid();
                } catch (\Exception) {
                    $valid = false;
                }

                if (!$valid) {
                    $fail('"' . $value . '" is not a valid IP address or CIDR range.');
                }
            }],
        ]);

        $key = $this->keyCreationService->setKeyType(ApiKey::TYPE_APPLICATION)->handle([
            'memo' => $request->input('memo'),
            'user_id' => $request->user()->id,
            'allowed_ips' => array_values(array_unique($request->input('allowed_ips') ?? [])),
        ], $request->getKeyPermissions());

        Activity::event('admin:api-key.create')->subject($key)->property('identifier', $key->identifier)->log();

        $resources = AdminAcl::getResourceList();
        sort($resources);

        return new JsonResponse([
            'key' => $this->format($key->load('user:id,username,email'), $resources),
            // The secret token is only ever returned once, right after creating the key.
            'token' => $key->identifier . $this->encrypter->decrypt($key->token),
        ], 201);
    }

    public function delete(Request $request, string $identifier): Response
    {
        $key = ApiKey::query()
            ->where('key_type', ApiKey::TYPE_APPLICATION)
            ->where('identifier', $identifier)
            ->firstOrFail();

        Activity::event('admin:api-key.delete')->property('identifier', $key->identifier)->log();
        $key->delete();

        return response('', 204);
    }

    private function format(ApiKey $key, array $resources): array
    {
        return [
            'identifier' => $key->identifier,
            'memo' => $key->memo,
            'allowed_ips' => $key->allowed_ips ?? [],
            'permissions' => collect($resources)->mapWithKeys(fn ($resource) => [$resource => (int) $key->{'r_' . $resource}]),
            'user' => $key->user ? ['id' => $key->user->id, 'username' => $key->user->username, 'email' => $key->user->email] : null,
            'last_used_at' => $key->last_used_at?->toAtomString(),
            'created_at' => $key->created_at?->toAtomString(),
        ];
    }
}
