<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Egg;
use Raptor\Models\Nest;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Nests\NestUpdateService;
use Raptor\Services\Nests\NestCreationService;
use Raptor\Services\Nests\NestDeletionService;
use Raptor\Http\Requests\Admin\Nest\StoreNestFormRequest;

class NestController extends AdminApiController
{
    public function __construct(
        private NestCreationService $creationService,
        private NestDeletionService $deletionService,
        private NestUpdateService $updateService,
    ) {
    }

    /**
     * Returns every nest together with its eggs, which is small enough to always be loaded in
     * a single request and lets the admin area render egg pickers without extra round trips.
     */
    public function index(): JsonResponse
    {
        $nests = Nest::query()
            ->with(['eggs' => fn ($query) => $query->withCount('servers')->orderBy('name')])
            ->withCount('servers')
            ->orderBy('id')
            ->get();

        return new JsonResponse([
            'data' => $nests->map(fn (Nest $nest) => array_merge($this->format($nest), [
                'eggs' => $nest->eggs->map(fn (Egg $egg) => [
                    'id' => $egg->id,
                    'uuid' => $egg->uuid,
                    'name' => $egg->name,
                    'description' => $egg->description,
                    'author' => $egg->author,
                    'servers' => (int) $egg->servers_count,
                    'docker_images' => $egg->docker_images,
                ])->values(),
            ])),
        ]);
    }

    public function store(StoreNestFormRequest $request): JsonResponse
    {
        $nest = $this->creationService->handle($request->normalize());

        Activity::event('admin:nest.create')->subject($nest)->property('name', $nest->name)->log();

        return new JsonResponse($this->format($nest->loadCount('servers')), 201);
    }

    public function update(StoreNestFormRequest $request, Nest $nest): JsonResponse
    {
        $this->updateService->handle($nest->id, $request->normalize());

        Activity::event('admin:nest.update')->subject($nest)->property('name', $nest->name)->log();

        return new JsonResponse($this->format($nest->refresh()->loadCount('servers')));
    }

    public function delete(Nest $nest): Response
    {
        $this->deletionService->handle($nest->id);

        Activity::event('admin:nest.delete')->property('name', $nest->name)->log();

        return response('', 204);
    }

    private function format(Nest $nest): array
    {
        return [
            'id' => $nest->id,
            'uuid' => $nest->uuid,
            'name' => $nest->name,
            'description' => $nest->description,
            'author' => $nest->author,
            'servers' => (int) ($nest->servers_count ?? 0),
        ];
    }
}
