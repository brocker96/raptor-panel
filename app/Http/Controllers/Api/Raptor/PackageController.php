<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\ServerPackage;
use Illuminate\Http\JsonResponse;
use Raptor\Services\RaptorApi\Lookup;
use Raptor\Services\RaptorApi\Presenter;
use Raptor\Services\RaptorApi\PackageDeployer;

/**
 * Packages are also managed in Admin → Packages, both use this controller.
 */
class PackageController extends RaptorController
{
    public function __construct(private PackageDeployer $deployer)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $packages = ServerPackage::query()->with('egg')->withCount('servers')
            ->when($request->has('active'), fn ($q) => $q->where('active', $request->boolean('active')))
            ->orderBy('sort')->orderBy('name')->get();

        return new JsonResponse(['data' => $packages->map(fn (ServerPackage $package) => Presenter::package($package))]);
    }

    public function show(string $package): JsonResponse
    {
        return new JsonResponse(Presenter::package(Lookup::package($package)->load('egg')->loadCount('servers')));
    }

    public function store(Request $request): JsonResponse
    {
        $package = ServerPackage::query()->create($request->validate(ServerPackage::rules()));

        Activity::event('raptor:package.create')->subject($package)->property('slug', $package->slug)->log();

        return new JsonResponse(Presenter::package($package->load('egg')), 201);
    }

    public function update(Request $request, string $package): JsonResponse
    {
        $package = Lookup::package($package);
        $rules = collect(ServerPackage::rules($package))->map(fn ($rule) => is_array($rule) ? ['sometimes', ...$rule] : 'sometimes|' . $rule)->all();
        $package->update($request->validate($rules));

        Activity::event('raptor:package.update')->subject($package)->property('slug', $package->slug)->log();

        return new JsonResponse(Presenter::package($package->load('egg')->loadCount('servers')));
    }

    /**
     * Servers made from a deleted package keep running, they just no longer point at it.
     */
    public function delete(string $package): Response
    {
        $package = Lookup::package($package);
        $package->delete();

        Activity::event('raptor:package.delete')->property('slug', $package->slug)->log();

        return response('', 204);
    }

    public function duplicate(string $package): JsonResponse
    {
        $source = Lookup::package($package);
        $copy = $source->replicate();
        $copy->slug = $this->freeSlug($source->slug . '-copy');
        $copy->name = $source->name . ' (copy)';
        $copy->active = false;
        $copy->save();

        return new JsonResponse(Presenter::package($copy->load('egg')), 201);
    }

    public function availability(string $package): JsonResponse
    {
        $package = Lookup::package($package);

        return new JsonResponse(['package' => $package->slug, 'active' => $package->active] + $this->deployer->availability($package));
    }

    private function freeSlug(string $slug): string
    {
        $candidate = $slug;
        for ($i = 2; ServerPackage::query()->where('slug', $candidate)->exists(); ++$i) {
            $candidate = $slug . '-' . $i;
        }

        return $candidate;
    }
}
