<?php

namespace Raptor\Services\RaptorApi;

use Raptor\Models\Egg;
use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\Server;
use Illuminate\Support\Arr;
use Raptor\Models\ServerPackage;
use Raptor\Models\Objects\DeploymentObject;
use Raptor\Services\Servers\ServerCreationService;
use Raptor\Services\Servers\BuildModificationService;
use Raptor\Services\Deployment\FindViableNodesService;
use Raptor\Services\Deployment\AllocationSelectionService;
use Raptor\Exceptions\Service\Deployment\NoViableNodeException;
use Raptor\Exceptions\Service\Deployment\NoViableAllocationException;

/**
 * Turns packages into servers and moves servers between packages.
 */
class PackageDeployer
{
    /** Limits a request may override per server, for add-ons sold on top of a package. */
    public const OVERRIDABLE = ['memory', 'swap', 'disk', 'io', 'cpu', 'threads', 'database_limit', 'allocation_limit', 'backup_limit'];

    public function __construct(
        private ServerCreationService $creation,
        private BuildModificationService $build,
        private FindViableNodesService $nodes,
        private AllocationSelectionService $allocations,
    ) {
    }

    /**
     * Creates a server from the package on the emptiest node that fits it.
     *
     * @throws \Throwable
     */
    public function deploy(ServerPackage $package, User $owner, array $options = []): Server
    {
        $egg = Egg::query()->with('variables')->findOrFail($package->egg_id);
        $limits = array_merge($package->limits(), Arr::only($options['overrides'] ?? [], self::OVERRIDABLE));

        $data = array_merge($limits, [
            'external_id' => $options['external_id'] ?? null,
            'name' => $options['name'] ?? $package->name,
            'description' => $options['description'] ?? '',
            'owner_id' => $owner->id,
            'egg_id' => $egg->id,
            'nest_id' => $egg->nest_id,
            'image' => $package->image ?: (array_values($egg->docker_images ?? [])[0] ?? null),
            'startup' => $package->startup ?: $egg->startup,
            'environment' => $this->environment($egg, $package, $options['environment'] ?? []),
            'start_on_completion' => $options['start_on_completion'] ?? $package->start_on_completion,
        ]);

        $allocation = $this->pickAllocation($package, (int) $data['memory'], (int) $data['disk']);
        $data['allocation_id'] = $allocation->id;
        $data['node_id'] = $allocation->node_id;

        $server = $this->creation->handle($data);
        $server->forceFill(['package_id' => $package->id])->saveQuietly();

        return $server;
    }

    /**
     * Applies the limits of another package to a server. The game, image and files stay as
     * they are, so upgrades and downgrades never wipe anything.
     *
     * @throws \Throwable
     */
    public function change(Server $server, ServerPackage $package, array $overrides = []): Server
    {
        $limits = array_merge($package->limits(), Arr::only($overrides, self::OVERRIDABLE));

        $server = $this->build->handle($server, $limits + ['allocation_id' => $server->allocation_id]);
        $server->forceFill(['package_id' => $package->id])->save();

        return $server;
    }

    /**
     * Whether a server of this package can be created right now, so a shop can hide sold out
     * plans before somebody pays for them.
     */
    public function availability(ServerPackage $package): array
    {
        try {
            $this->pickAllocation($package, $package->memory, $package->disk);

            return ['available' => true, 'reason' => null];
        } catch (NoViableNodeException) {
            return ['available' => false, 'reason' => 'no_node_with_capacity'];
        } catch (NoViableAllocationException) {
            return ['available' => false, 'reason' => 'no_free_allocation'];
        }
    }

    /**
     * Package defaults, then the egg defaults, with the request on top. Only variables the egg
     * defines are kept.
     */
    private function environment(Egg $egg, ServerPackage $package, array $requested): array
    {
        $environment = [];
        foreach ($egg->variables as $variable) {
            $environment[$variable->env_variable] = $requested[$variable->env_variable]
                ?? $package->environment[$variable->env_variable]
                ?? $variable->default_value;
        }

        return $environment;
    }

    private function pickAllocation(ServerPackage $package, int $memory, int $disk): \Raptor\Models\Allocation
    {
        $deployment = (new DeploymentObject())
            ->setDedicated($package->dedicated_ip)
            ->setLocations($package->location_ids ?? [])
            ->setPorts($package->port_range ?? []);

        $nodes = $this->nodes->setLocations($deployment->getLocations())->setDisk($disk)->setMemory($memory)->handle()->pluck('id');
        if (!empty($package->node_ids)) {
            $nodes = $nodes->intersect($package->node_ids);
        }
        if ($nodes->isEmpty()) {
            throw new NoViableNodeException(trans('exceptions.deployment.no_viable_nodes'));
        }

        // The emptiest node first, so new servers spread out instead of piling onto one.
        $ordered = Node::query()->whereIn('id', $nodes)->withSum('servers', 'memory')->get()
            ->sortBy(fn (Node $node) => $node->memory > 0 ? ($node->servers_sum_memory ?? 0) / $node->memory : 1)
            ->pluck('id');

        foreach ($ordered as $node) {
            try {
                return $this->allocations->setDedicated($deployment->isDedicated())->setNodes([$node])->setPorts($deployment->getPorts())->handle();
            } catch (NoViableAllocationException) {
                continue;
            }
        }

        throw new NoViableAllocationException(trans('exceptions.deployment.no_viable_allocations'));
    }
}
