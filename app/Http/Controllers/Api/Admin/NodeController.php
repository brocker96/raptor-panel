<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Node;
use Raptor\Models\ApiKey;
use Raptor\Models\Server;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\Allocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\Builder;
use Raptor\Services\Api\KeyCreationService;
use Raptor\Services\Nodes\NodeUpdateService;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Services\Nodes\NodeCreationService;
use Raptor\Services\Nodes\NodeDeletionService;
use Raptor\Services\Allocations\AssignmentService;
use Raptor\Http\Requests\Admin\Node\NodeFormRequest;
use Raptor\Http\Requests\Admin\Node\AllocationFormRequest;
use Raptor\Repositories\Wings\DaemonConfigurationRepository;

class NodeController extends AdminApiController
{
    public function __construct(
        private AssignmentService $assignmentService,
        private DaemonConfigurationRepository $daemonConfigurationRepository,
        private Encrypter $encrypter,
        private KeyCreationService $keyCreationService,
        private NodeCreationService $creationService,
        private NodeDeletionService $deletionService,
        private NodeUpdateService $updateService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = $this->withUsage(Node::query()->with('location:id,short,long'));

        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn (Builder $builder) => $builder
                ->where('nodes.name', 'like', $this->like($search))
                ->orWhere('nodes.fqdn', 'like', $this->like($search)));
        }

        if ($location = $request->query('location')) {
            $query->where('nodes.location_id', (int) $location);
        }

        return $this->paginated($query->orderBy('nodes.id')->paginate($this->perPage($request)), fn (Node $node) => $this->format($node));
    }

    public function view(Node $node): JsonResponse
    {
        $node = $this->withUsage(Node::query()->with('location:id,short,long'))->findOrFail($node->id);

        $allocations = Allocation::query()
            ->where('node_id', $node->id)
            ->selectRaw('COUNT(*) as total, SUM(server_id IS NOT NULL) as assigned')
            ->first();

        return new JsonResponse(array_merge($this->format($node), [
            'allocations' => [
                'total' => (int) $allocations->getAttribute('total'),
                'assigned' => (int) $allocations->getAttribute('assigned'),
            ],
        ]));
    }

    public function store(NodeFormRequest $request): JsonResponse
    {
        $node = $this->creationService->handle($request->normalize());

        Activity::event('admin:node.create')->subject($node)->property('name', $node->name)->log();

        return new JsonResponse(['id' => $node->id], 201);
    }

    public function update(NodeFormRequest $request, Node $node): Response
    {
        $this->updateService->handle($node, $request->normalize(), $request->boolean('reset_secret'));

        Activity::event('admin:node.update')->subject($node)->property('name', $node->name)->log();

        return response('', 204);
    }

    public function delete(Node $node): Response
    {
        $this->deletionService->handle($node);

        Activity::event('admin:node.delete')->property('name', $node->name)->log();

        return response('', 204);
    }

    /**
     * Asks Wings for information about the machine it is running on. A failure here is not an
     * error from the admin's point of view, it simply means the node is offline.
     */
    public function system(Node $node): JsonResponse
    {
        $started = microtime(true);

        try {
            $data = $this->daemonConfigurationRepository->setNode($node)->getSystemInformation();
        } catch (\Throwable $exception) {
            return new JsonResponse([
                'online' => false,
                'error' => Str::limit($exception->getPrevious()?->getMessage() ?? $exception->getMessage(), 300),
            ]);
        }

        return new JsonResponse([
            'online' => true,
            'latency' => (int) round((microtime(true) - $started) * 1000),
            'version' => $data['version'] ?? '',
            'system' => [
                'type' => Str::title($data['os'] ?? 'Unknown'),
                'arch' => $data['architecture'] ?? '--',
                'release' => $data['kernel_version'] ?? '--',
                'cpus' => (int) ($data['cpu_count'] ?? 0),
            ],
        ]);
    }

    /**
     * Returns the Wings configuration file for the node along with a ready-to-run auto deploy
     * command that downloads it.
     */
    public function configuration(Request $request, Node $node): JsonResponse
    {
        $key = ApiKey::query()
            ->where('user_id', $request->user()->id)
            ->where('key_type', ApiKey::TYPE_APPLICATION)
            ->where('r_nodes', 1)
            ->where('memo', 'Automatically generated node deployment key.')
            ->first();

        if ($request->boolean('deploy') && !$key) {
            $key = $this->keyCreationService->setKeyType(ApiKey::TYPE_APPLICATION)->handle([
                'user_id' => $request->user()->id,
                'memo' => 'Automatically generated node deployment key.',
                'allowed_ips' => [],
            ], ['r_nodes' => 1]);
        }

        $command = null;
        if ($key) {
            $command = sprintf(
                'cd /etc/pterodactyl && sudo wings configure --panel-url %s --token %s --node %d' . (config('app.debug') ? ' --allow-insecure' : ''),
                config('app.url'),
                $key->identifier . $this->encrypter->decrypt($key->token),
                $node->id,
            );
        }

        return new JsonResponse([
            'yaml' => $node->getYamlConfiguration(),
            'deploy_command' => $command,
        ]);
    }

    public function allocations(Request $request, Node $node): JsonResponse
    {
        $query = Allocation::query()
            ->with('server:id,uuidShort,name')
            ->where('node_id', $node->id);

        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn (Builder $builder) => $builder
                ->where('ip', 'like', $this->like($search))
                ->orWhere('ip_alias', 'like', $this->like($search))
                ->orWhere('port', 'like', $this->like($search))
                ->orWhere('notes', 'like', $this->like($search)));
        }

        match ($request->query('filter')) {
            'assigned' => $query->whereNotNull('server_id'),
            'unassigned' => $query->whereNull('server_id'),
            default => null,
        };

        $ips = Allocation::query()->where('node_id', $node->id)->distinct()->orderBy('ip')->pluck('ip');

        $response = $this->paginated(
            $query->orderBy('ip')->orderBy('port')->paginate($this->perPage($request, 50)),
            fn (Allocation $allocation) => [
                'id' => $allocation->id,
                'ip' => $allocation->ip,
                'alias' => $allocation->ip_alias,
                'port' => $allocation->port,
                'notes' => $allocation->notes,
                'server' => $allocation->server ? ['id' => $allocation->server->id, 'name' => $allocation->server->name, 'identifier' => $allocation->server->uuidShort] : null,
            ],
        );

        return $response->setData(array_merge($response->getData(true), ['ips' => $ips]));
    }

    public function storeAllocations(AllocationFormRequest $request, Node $node): Response
    {
        $this->assignmentService->handle($node, $request->normalize());

        Activity::event('admin:node.allocations-create')->subject($node)
            ->property(['ip' => $request->input('allocation_ip'), 'ports' => implode(', ', $request->input('allocation_ports'))])
            ->log();

        return response('', 204);
    }

    public function updateAllocation(Request $request, Node $node, Allocation $allocation): Response
    {
        $data = $request->validate([
            'alias' => 'present|nullable|string|max:191',
        ]);

        $allocation->update(['ip_alias' => empty($data['alias']) ? null : $data['alias']]);

        return response('', 204);
    }

    /**
     * Deletes the given allocations. Allocations that are assigned to a server are skipped and
     * reported back so that the admin area can explain why they were not removed.
     */
    public function deleteAllocations(Request $request, Node $node): JsonResponse
    {
        $data = $request->validate([
            'ids' => 'required_without:ip|array|max:5000',
            'ids.*' => 'integer',
            'ip' => 'required_without:ids|ip',
        ]);

        $query = Allocation::query()->where('node_id', $node->id);
        isset($data['ids']) ? $query->whereIn('id', $data['ids']) : $query->where('ip', $data['ip']);

        $skipped = (clone $query)->whereNotNull('server_id')->count();
        $deleted = $query->whereNull('server_id')->delete();

        Activity::event('admin:node.allocations-delete')->subject($node)->property(['deleted' => $deleted, 'skipped' => $skipped])->log();

        return new JsonResponse(['deleted' => $deleted, 'skipped' => $skipped]);
    }

    /**
     * Adds the memory and disk allocated to servers on each node as aggregate columns.
     */
    private function withUsage(Builder $query): Builder
    {
        return $query
            ->select('nodes.*')
            ->selectSub(Server::query()->selectRaw('IFNULL(SUM(memory), 0)')->whereColumn('servers.node_id', 'nodes.id'), 'allocated_memory')
            ->selectSub(Server::query()->selectRaw('IFNULL(SUM(disk), 0)')->whereColumn('servers.node_id', 'nodes.id'), 'allocated_disk')
            ->selectSub(Server::query()->selectRaw('COUNT(*)')->whereColumn('servers.node_id', 'nodes.id'), 'servers_count');
    }

    private function format(Node $node): array
    {
        return [
            'id' => $node->id,
            'uuid' => $node->uuid,
            'name' => $node->name,
            'description' => $node->description,
            'location' => $node->location ? ['id' => $node->location->id, 'short' => $node->location->short, 'long' => $node->location->long] : null,
            'public' => $node->public,
            'fqdn' => $node->fqdn,
            'scheme' => $node->scheme,
            'behind_proxy' => $node->behind_proxy,
            'maintenance_mode' => $node->maintenance_mode,
            'memory' => $node->memory,
            'memory_overallocate' => (int) $node->memory_overallocate,
            'disk' => $node->disk,
            'disk_overallocate' => (int) $node->disk_overallocate,
            'upload_size' => (int) $node->upload_size,
            'daemon_listen' => $node->daemonListen,
            'daemon_sftp' => $node->daemonSFTP,
            'daemon_base' => $node->daemonBase,
            'usage' => [
                'memory' => (int) $node->getAttribute('allocated_memory'),
                'disk' => (int) $node->getAttribute('allocated_disk'),
                'servers' => (int) $node->getAttribute('servers_count'),
            ],
            'created_at' => $node->created_at?->toAtomString(),
        ];
    }
}
