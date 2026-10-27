<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Mount;
use Raptor\Enum\JwtScope;
use Raptor\Models\Server;
use Carbon\CarbonImmutable;
use Raptor\Models\Database;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\Allocation;
use Raptor\Models\EggVariable;
use Raptor\Models\MountServer;
use Illuminate\Http\JsonResponse;
use Raptor\Models\ServerTransfer;
use Raptor\Exceptions\DisplayException;
use Illuminate\Database\Eloquent\Builder;
use Raptor\Services\Nodes\NodeJWTService;
use Illuminate\Database\ConnectionInterface;
use Raptor\Repositories\Eloquent\NodeRepository;
use Raptor\Repositories\Wings\DaemonTransferRepository;

class ServerController extends AdminApiController
{
    public function __construct(
        private ConnectionInterface $connection,
        private DaemonTransferRepository $daemonTransferRepository,
        private NodeJWTService $nodeJWTService,
        private NodeRepository $nodeRepository,
    ) {
    }

    /**
     * Lists servers with a free text search across the server, its owner and its node, plus
     * filters for the most common administrative questions ("what is suspended on node 2?").
     */
    public function index(Request $request): JsonResponse
    {
        $query = Server::query()->with(['user:id,username,email', 'node:id,name', 'allocation', 'egg:id,name']);

        if ($search = trim((string) $request->query('search'))) {
            $like = $this->like($search);
            $query->where(fn (Builder $builder) => $builder
                ->where('servers.name', 'like', $like)
                ->orWhere('servers.uuid', 'like', $like)
                ->orWhere('servers.external_id', 'like', $like)
                ->orWhereHas('user', fn (Builder $user) => $user->where('username', 'like', $like)->orWhere('email', 'like', $like))
                ->orWhereHas('allocation', fn (Builder $allocation) => $allocation->where('ip', 'like', $like)->orWhere('ip_alias', 'like', $like)->orWhere('port', 'like', $like)));
        }

        foreach (['node' => 'node_id', 'owner' => 'owner_id', 'egg' => 'egg_id', 'nest' => 'nest_id'] as $param => $column) {
            if ($value = $request->query($param)) {
                $query->where("servers.$column", (int) $value);
            }
        }

        match ($request->query('status')) {
            'installed' => $query->whereNull('status'),
            'installing' => $query->where('status', Server::STATUS_INSTALLING),
            'failed' => $query->whereIn('status', [Server::STATUS_INSTALL_FAILED, Server::STATUS_REINSTALL_FAILED]),
            'suspended' => $query->where('status', Server::STATUS_SUSPENDED),
            default => null,
        };

        $sort = $request->query('sort', '-id');
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        $query->orderBy(in_array($column, ['id', 'name', 'memory', 'disk', 'cpu', 'created_at']) ? "servers.$column" : 'servers.id', $direction);

        return $this->paginated($query->paginate($this->perPage($request)), fn (Server $server) => $this->summary($server));
    }

    public function view(Server $server): JsonResponse
    {
        $server->load(['user', 'node.location', 'allocations', 'egg', 'nest', 'transfer', 'mounts']);
        Server::loadVariablesFor([$server]);

        $databases = Database::query()->with('host:id,name,host,port')->where('server_id', $server->id)->get()
            ->map(fn (Database $database) => [
                'id' => $database->id,
                'database' => $database->database,
                'username' => $database->username,
                'remote' => $database->remote,
                'max_connections' => $database->max_connections,
                'host' => $database->host ? ['id' => $database->host->id, 'name' => $database->host->name, 'address' => $database->host->host . ':' . $database->host->port] : null,
            ]);

        $availableMounts = Mount::query()
            ->whereHas('eggs', fn (Builder $query) => $query->where('eggs.id', $server->egg_id))
            ->whereHas('nodes', fn (Builder $query) => $query->where('nodes.id', $server->node_id))
            ->get();
        $attached = $server->mounts->pluck('id')->all();

        return new JsonResponse(array_merge($this->summary($server), [
            'description' => $server->description,
            'external_id' => $server->external_id,
            'limits' => [
                'memory' => $server->memory,
                'swap' => $server->swap,
                'disk' => $server->disk,
                'io' => $server->io,
                'cpu' => $server->cpu,
                'threads' => $server->threads,
                'oom_disabled' => $server->oom_disabled,
            ],
            'feature_limits' => [
                'databases' => $server->database_limit,
                'allocations' => $server->allocation_limit,
                'backups' => $server->backup_limit,
            ],
            'container' => [
                'startup' => $server->startup,
                'image' => $server->image,
                'skip_scripts' => $server->skip_scripts,
                'images' => $server->egg?->docker_images ?? [],
                'default_startup' => $server->egg?->startup,
            ],
            'nest' => $server->nest ? ['id' => $server->nest->id, 'name' => $server->nest->name] : null,
            'allocation_id' => $server->allocation_id,
            'allocations' => $server->allocations->sortBy('port')->map(fn (Allocation $allocation) => [
                'id' => $allocation->id,
                'ip' => $allocation->ip,
                'alias' => $allocation->ip_alias,
                'port' => $allocation->port,
                'notes' => $allocation->notes,
                'is_default' => $allocation->id === $server->allocation_id,
            ])->values(),
            'variables' => $server->variables->map(fn (EggVariable $variable) => [
                'id' => $variable->id,
                'name' => $variable->name,
                'description' => $variable->description,
                'env_variable' => $variable->env_variable,
                'default_value' => $variable->default_value,
                'server_value' => $variable->server_value,
                'rules' => $variable->rules,
                'user_viewable' => $variable->user_viewable,
                'user_editable' => $variable->user_editable,
            ])->values(),
            'databases' => $databases,
            'mounts' => $availableMounts->map(fn (Mount $mount) => [
                'id' => $mount->id,
                'name' => $mount->name,
                'source' => $mount->source,
                'target' => $mount->target,
                'read_only' => (bool) $mount->read_only,
                'attached' => in_array($mount->id, $attached),
            ])->values(),
            'transfer' => $server->transfer ? [
                'old_node' => $server->transfer->old_node,
                'new_node' => $server->transfer->new_node,
                'successful' => $server->transfer->successful,
                'archived' => $server->transfer->archived,
            ] : null,
            'installed_at' => $server->installed_at?->toAtomString(),
            'updated_at' => $server->updated_at?->toAtomString(),
        ]));
    }

    /**
     * Toggles the installation status of a server, which is useful when an install script was
     * interrupted and the server is stuck as "installing".
     */
    public function toggleInstall(Server $server): Response
    {
        if ($server->status === Server::STATUS_INSTALL_FAILED) {
            throw new DisplayException(trans('admin/server.exceptions.marked_as_failed'));
        }

        $server->update(['status' => $server->isInstalled() ? Server::STATUS_INSTALLING : null]);

        Activity::event('admin:server.toggle-install')->subject($server)->log();

        return response('', 204);
    }

    /**
     * Starts transferring the server to another node.
     */
    public function transfer(Request $request, Server $server): Response
    {
        $data = $request->validate([
            'node_id' => 'required|integer|exists:nodes,id',
            'allocation_id' => 'required|integer|bail|unique:servers|exists:allocations,id',
            'allocation_additional' => 'nullable|array',
            'allocation_additional.*' => 'integer|exists:allocations,id',
        ]);

        $nodeId = (int) $data['node_id'];
        if ($nodeId === $server->node_id) {
            throw new DisplayException('The server is already running on this node.');
        }

        $node = $this->nodeRepository->getNodeWithResourceUsage($nodeId);
        if (!$node->isViable($server->memory, $server->disk)) {
            throw new DisplayException(trans('admin/server.alerts.transfer_not_viable'));
        }

        $server->validateTransferState();

        $allocations = array_values(array_unique(array_merge([(int) $data['allocation_id']], array_map('intval', $data['allocation_additional'] ?? []))));
        $usable = Allocation::query()->where('node_id', $nodeId)->whereNull('server_id')->whereIn('id', $allocations)->pluck('id')->all();
        if (!in_array((int) $data['allocation_id'], $usable)) {
            throw new DisplayException('The selected primary allocation does not belong to the target node or is already in use.');
        }

        $this->connection->transaction(function () use ($server, $nodeId, $data, $usable) {
            $transfer = new ServerTransfer();
            $transfer->server_id = $server->id;
            $transfer->old_node = $server->node_id;
            $transfer->new_node = $nodeId;
            $transfer->old_allocation = $server->allocation_id;
            $transfer->new_allocation = (int) $data['allocation_id'];
            $transfer->old_additional_allocations = $server->allocations->where('id', '!=', $server->allocation_id)->pluck('id')->values()->toArray();
            $transfer->new_additional_allocations = array_values(array_diff($usable, [(int) $data['allocation_id']]));
            $transfer->save();

            // Reserve the allocations so they cannot be assigned while the transfer runs.
            Allocation::query()->whereIn('id', $usable)->update(['server_id' => $server->id]);

            $token = $this->nodeJWTService
                ->setExpiresAt(CarbonImmutable::now()->addMinutes(15))
                ->setSubject($server->uuid)
                ->setScopes(JwtScope::ServerTransfer)
                ->handle($transfer->newNode, $server->uuid);

            $this->daemonTransferRepository->setServer($server)->notify($transfer->newNode, $token);
        });

        Activity::event('admin:server.transfer')->subject($server)->property(['from' => $server->node_id, 'to' => $nodeId])->log();

        return response('', 204);
    }

    public function attachMount(Request $request, Server $server): Response
    {
        $data = $request->validate(['mount_id' => 'required|integer|exists:mounts,id']);

        $attributes = ['mount_id' => $data['mount_id'], 'server_id' => $server->id];
        if (!$this->connection->table('mount_server')->where($attributes)->exists()) {
            $this->connection->table('mount_server')->insert($attributes);
        }

        Activity::event('admin:server.mount-attach')->subject($server)->property('mount', $data['mount_id'])->log();

        return response('', 204);
    }

    public function detachMount(Server $server, int $mount): Response
    {
        MountServer::query()->where('mount_id', $mount)->where('server_id', $server->id)->delete();

        Activity::event('admin:server.mount-detach')->subject($server)->property('mount', $mount)->log();

        return response('', 204);
    }

    private function summary(Server $server): array
    {
        return [
            'id' => $server->id,
            'uuid' => $server->uuid,
            'identifier' => $server->uuidShort,
            'name' => $server->name,
            'status' => $server->status,
            'suspended' => $server->isSuspended(),
            'owner' => $server->user ? ['id' => $server->user->id, 'username' => $server->user->username, 'email' => $server->user->email] : null,
            'node' => $server->node ? ['id' => $server->node->id, 'name' => $server->node->name] : null,
            'egg' => $server->egg ? ['id' => $server->egg->id, 'name' => $server->egg->name] : null,
            'allocation' => $server->allocation ? ['ip' => $server->allocation->ip, 'alias' => $server->allocation->ip_alias, 'port' => $server->allocation->port] : null,
            'memory' => $server->memory,
            'disk' => $server->disk,
            'cpu' => $server->cpu,
            'created_at' => $server->created_at?->toAtomString(),
        ];
    }
}
