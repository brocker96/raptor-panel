<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Ramsey\Uuid\Uuid;
use Raptor\Models\Egg;
use Raptor\Models\Node;
use Raptor\Models\Mount;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Http\Requests\Admin\MountFormRequest;

class MountController extends AdminApiController
{
    public function index(): JsonResponse
    {
        $mounts = Mount::query()->withCount(['eggs', 'nodes', 'servers'])->orderBy('id')->get();

        return new JsonResponse(['data' => $mounts->map(fn (Mount $mount) => $this->format($mount))]);
    }

    public function view(Mount $mount): JsonResponse
    {
        $mount->load(['eggs.nest', 'nodes', 'servers'])->loadCount(['eggs', 'nodes', 'servers']);

        return new JsonResponse(array_merge($this->format($mount), [
            'eggs' => $mount->eggs->map(fn (Egg $egg) => ['id' => $egg->id, 'name' => $egg->name, 'nest' => $egg->nest?->name])->values(),
            'nodes' => $mount->nodes->map(fn (Node $node) => ['id' => $node->id, 'name' => $node->name])->values(),
            'servers' => $mount->servers->map(fn ($server) => ['id' => $server->id, 'name' => $server->name, 'identifier' => $server->uuidShort])->values(),
        ]));
    }

    public function store(MountFormRequest $request): JsonResponse
    {
        $mount = (new Mount())->fill($request->validated());
        $mount->forceFill(['uuid' => Uuid::uuid4()->toString()])->saveOrFail();

        Activity::event('admin:mount.create')->subject($mount)->property('name', $mount->name)->log();

        return new JsonResponse($this->format($mount->fresh()->loadCount(['eggs', 'nodes', 'servers'])), 201);
    }

    public function update(MountFormRequest $request, Mount $mount): JsonResponse
    {
        $mount->forceFill($request->validated())->save();

        Activity::event('admin:mount.update')->subject($mount)->property('name', $mount->name)->log();

        return new JsonResponse($this->format($mount->loadCount(['eggs', 'nodes', 'servers'])));
    }

    public function delete(Mount $mount): Response
    {
        Activity::event('admin:mount.delete')->property('name', $mount->name)->log();
        $mount->delete();

        return response('', 204);
    }

    /**
     * Replaces the set of eggs and nodes the mount is available to.
     */
    public function sync(Request $request, Mount $mount): Response
    {
        $data = $request->validate([
            'eggs' => 'sometimes|array',
            'eggs.*' => 'integer|exists:eggs,id',
            'nodes' => 'sometimes|array',
            'nodes.*' => 'integer|exists:nodes,id',
        ]);

        if (array_key_exists('eggs', $data)) {
            $mount->eggs()->sync($data['eggs']);
        }

        if (array_key_exists('nodes', $data)) {
            $mount->nodes()->sync($data['nodes']);
        }

        Activity::event('admin:mount.sync')->subject($mount)->property('name', $mount->name)->log();

        return response('', 204);
    }

    private function format(Mount $mount): array
    {
        return [
            'id' => $mount->id,
            'uuid' => $mount->uuid,
            'name' => $mount->name,
            'description' => $mount->description,
            'source' => $mount->source,
            'target' => $mount->target,
            'read_only' => (bool) $mount->read_only,
            'user_mountable' => (bool) $mount->user_mountable,
            'counts' => [
                'eggs' => (int) ($mount->eggs_count ?? 0),
                'nodes' => (int) ($mount->nodes_count ?? 0),
                'servers' => (int) ($mount->servers_count ?? 0),
            ],
        ];
    }
}
