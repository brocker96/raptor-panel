<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Raptor\Models\Egg;
use Raptor\Models\Node;
use Raptor\Models\ApiKey;
use Raptor\Models\Location;
use Illuminate\Http\Request;
use Raptor\Models\ServerPackage;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Services\RaptorApi\Presenter;

class MetaController extends RaptorController
{
    /**
     * "Test connection" for billing modules: proves the URL and key work and shows what the
     * key may do.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var ApiKey $key */
        $key = $request->user()->currentAccessToken();

        return new JsonResponse([
            'api' => 'raptor',
            'version' => 'v1',
            'panel' => ['name' => config('app.name'), 'version' => config('app.version'), 'url' => url('/')],
            'time' => now()->toAtomString(),
            'key' => [
                'identifier' => $key->identifier,
                'memo' => $key->memo,
                'permissions' => collect(AdminAcl::getResourceList())->mapWithKeys(fn ($resource) => [
                    $resource => match (true) {
                        AdminAcl::check($key, $resource, AdminAcl::WRITE) => 'write',
                        AdminAcl::check($key, $resource) => 'read',
                        default => 'none',
                    },
                ]),
            ],
            'packages' => ServerPackage::query()->where('active', true)->count(),
        ]);
    }

    public function eggs(): JsonResponse
    {
        $eggs = Egg::query()->with(['nest', 'variables'])->orderBy('nest_id')->orderBy('name')->get();

        return new JsonResponse(['data' => $eggs->map(fn (Egg $egg) => Presenter::egg($egg))]);
    }

    public function locations(): JsonResponse
    {
        return new JsonResponse(['data' => Location::query()->withCount('nodes')->orderBy('short')->get()->map(fn (Location $l) => [
            'id' => $l->id,
            'short' => $l->short,
            'long' => $l->long,
            'nodes_count' => $l->nodes_count,
        ])]);
    }

    /**
     * Nodes with what is left on them, memory and disk in MiB.
     */
    public function nodes(): JsonResponse
    {
        $nodes = Node::query()->withSum('servers', 'memory')->withSum('servers', 'disk')->withCount('servers')->orderBy('name')->get();

        return new JsonResponse(['data' => $nodes->map(fn (Node $node) => [
            'id' => $node->id,
            'name' => $node->name,
            'location_id' => $node->location_id,
            'fqdn' => $node->fqdn,
            'public' => (bool) $node->public,
            'maintenance' => (bool) $node->maintenance_mode,
            'servers_count' => $node->servers_count,
            'memory' => ['total' => $node->memory * (1 + $node->memory_overallocate / 100), 'used' => (int) $node->servers_sum_memory],
            'disk' => ['total' => $node->disk * (1 + $node->disk_overallocate / 100), 'used' => (int) $node->servers_sum_disk],
        ])]);
    }
}
