<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Node;
use Raptor\Models\Location;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Http\Requests\Admin\LocationFormRequest;
use Raptor\Services\Locations\LocationUpdateService;
use Raptor\Services\Locations\LocationCreationService;
use Raptor\Services\Locations\LocationDeletionService;

class LocationController extends AdminApiController
{
    public function __construct(
        private LocationCreationService $creationService,
        private LocationDeletionService $deletionService,
        private LocationUpdateService $updateService,
    ) {
    }

    public function index(): JsonResponse
    {
        $locations = Location::query()->with('nodes:id,name,location_id')->withCount(['nodes', 'servers'])->orderBy('id')->get();

        return new JsonResponse(['data' => $locations->map(fn (Location $location) => $this->format($location))]);
    }

    public function store(LocationFormRequest $request): JsonResponse
    {
        $location = $this->creationService->handle($request->normalize());

        Activity::event('admin:location.create')->subject($location)->property('short', $location->short)->log();

        return new JsonResponse($this->format($location->load('nodes')->loadCount(['nodes', 'servers'])), 201);
    }

    public function update(LocationFormRequest $request, Location $location): JsonResponse
    {
        $location = $this->updateService->handle($location, $request->normalize());

        Activity::event('admin:location.update')->subject($location)->property('short', $location->short)->log();

        return new JsonResponse($this->format($location->load('nodes')->loadCount(['nodes', 'servers'])));
    }

    public function delete(Location $location): Response
    {
        $this->deletionService->handle($location);

        Activity::event('admin:location.delete')->property('short', $location->short)->log();

        return response('', 204);
    }

    private function format(Location $location): array
    {
        return [
            'id' => $location->id,
            'short' => $location->short,
            'long' => $location->long,
            'nodes' => $location->nodes->map(fn (Node $node) => ['id' => $node->id, 'name' => $node->name])->values(),
            'nodes_count' => (int) ($location->nodes_count ?? 0),
            'servers_count' => (int) ($location->servers_count ?? 0),
            'created_at' => $location->created_at?->toAtomString(),
        ];
    }
}
