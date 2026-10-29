<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Raptor\Models\User;
use Raptor\Models\Server;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Raptor\Services\RaptorApi\Lookup;
use Raptor\Services\RaptorApi\Accounts;
use Raptor\Services\RaptorApi\Presenter;
use Raptor\Services\RaptorApi\PackageDeployer;
use Raptor\Services\Servers\SuspensionService;
use Raptor\Services\Servers\ServerDeletionService;
use Raptor\Services\Servers\ReinstallServerService;
use Raptor\Repositories\Wings\DaemonPowerRepository;
use Raptor\Repositories\Wings\DaemonServerRepository;
use Raptor\Services\Servers\BuildModificationService;
use Raptor\Services\Servers\DetailsModificationService;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Raptor\Exceptions\Service\Deployment\NoViableNodeException;
use Raptor\Exceptions\Http\Connection\DaemonConnectionException;
use Raptor\Exceptions\Service\Deployment\NoViableAllocationException;

class ServerController extends RaptorController
{
    public function __construct(private PackageDeployer $deployer, private Accounts $accounts)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Server::query()->with(['allocation', 'node', 'user', 'egg', 'package'])->orderByDesc('id');

        if ($request->filled('external_id')) {
            $query->where('external_id', $request->query('external_id'));
        }
        if ($request->filled('user')) {
            $query->where('owner_id', Lookup::user((string) $request->query('user'))->id);
        }
        if ($request->filled('package')) {
            $query->where('package_id', Lookup::package((string) $request->query('package'))->id);
        }
        if ($request->filled('state')) {
            $state = (string) $request->query('state');
            $state === 'active' ? $query->whereNull('status') : $query->where('status', $state);
        }

        return $this->paginated($query->paginate($this->perPage($request)), fn (Server $server) => Presenter::server($server));
    }

    public function show(string $server): JsonResponse
    {
        return new JsonResponse(Presenter::server(Lookup::server($server)));
    }

    /**
     * Creates a server from a package for a user, creating the user too when needed. Sending
     * the same external_id twice returns the first server instead of making a second one.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package' => 'required',
            'user' => 'required',
            'external_id' => 'nullable|string|max:191',
            'name' => 'nullable|string|max:191',
            'description' => 'nullable|string|max:2000',
            'environment' => 'nullable|array',
            'environment.*' => 'nullable|string|max:2000',
            'overrides' => 'nullable|array',
            'overrides.*' => 'nullable',
            'start_on_completion' => 'boolean',
            'send_welcome_email' => 'boolean',
            'login_link' => 'boolean',
        ]);

        if (!empty($data['external_id']) && ($existing = Server::query()->where('external_id', $data['external_id'])->first())) {
            return new JsonResponse(['existing' => true, 'server' => Presenter::server(Lookup::server((string) $existing->id))]);
        }

        $package = Lookup::package((string) $data['package']);
        if (!$package->active) {
            throw new HttpException(422, "The package \"$package->slug\" is not active.");
        }

        [$user, $created] = $this->resolveUser($request->input('user'), $request->boolean('send_welcome_email', true));

        try {
            $server = $this->deployer->deploy($package, $user, $data);
        } catch (NoViableNodeException|NoViableAllocationException $exception) {
            throw new HttpException(409, 'No node has room for this package right now: ' . $exception->getMessage());
        }

        Activity::event('raptor:server.provision')->subject($server)->property(['package' => $package->slug, 'external_id' => $server->external_id])->log();

        return new JsonResponse(array_filter([
            'existing' => false,
            'server' => Presenter::server(Lookup::server((string) $server->id)),
            'user' => Presenter::userSummary($user) + ['created' => $created],
            'login_link' => $request->boolean('login_link') ? $this->accounts->loginLink($user, '/server/' . $server->uuidShort) : null,
        ], fn ($value) => $value !== null), 201);
    }

    public function update(Request $request, string $server, DetailsModificationService $details): JsonResponse
    {
        $server = Lookup::server($server);
        $data = $request->validate([
            'name' => 'sometimes|string|max:191',
            'description' => 'sometimes|nullable|string|max:2000',
            'external_id' => ['sometimes', 'nullable', 'string', 'max:191', Rule::unique('servers', 'external_id')->ignore($server->id)],
            'owner' => 'sometimes|string',
        ]);

        $details->handle($server, [
            'name' => $data['name'] ?? $server->name,
            'description' => array_key_exists('description', $data) ? (string) $data['description'] : $server->description,
            'external_id' => array_key_exists('external_id', $data) ? $data['external_id'] : $server->external_id,
            'owner_id' => isset($data['owner']) ? Lookup::user($data['owner'])->id : $server->owner_id,
        ]);

        return $this->show((string) $server->id);
    }

    /**
     * Upgrade or downgrade: the server gets the limits of another package, its files and game
     * stay as they are.
     */
    public function package(Request $request, string $server): JsonResponse
    {
        $data = $request->validate(['package' => 'required', 'overrides' => 'nullable|array']);
        $server = Lookup::server($server);
        $package = Lookup::package((string) $data['package']);

        $this->deployer->change($server, $package, $data['overrides'] ?? []);
        Activity::event('raptor:server.package')->subject($server)->property('package', $package->slug)->log();

        return $this->show((string) $server->id);
    }

    /**
     * Changes single limits on top of the package, for add-ons like "+2 GB RAM".
     */
    public function limits(Request $request, string $server, BuildModificationService $build): JsonResponse
    {
        $server = Lookup::server($server);
        $data = $request->validate([
            'memory' => 'sometimes|integer|min:0',
            'swap' => 'sometimes|integer|min:-1',
            'disk' => 'sometimes|integer|min:0',
            'io' => 'sometimes|integer|between:10,1000',
            'cpu' => 'sometimes|integer|min:0',
            'threads' => 'sometimes|nullable|regex:/^[0-9-,]+$/',
            'database_limit' => 'sometimes|integer|min:0',
            'allocation_limit' => 'sometimes|integer|min:0',
            'backup_limit' => 'sometimes|integer|min:0',
        ]);

        $build->handle($server, $data + [
            'allocation_id' => $server->allocation_id,
            'database_limit' => $server->database_limit,
            'allocation_limit' => $server->allocation_limit,
            'backup_limit' => $server->backup_limit,
        ]);

        return $this->show((string) $server->id);
    }

    public function suspend(string $server, SuspensionService $suspension): JsonResponse
    {
        $server = Lookup::server($server);
        $suspension->toggle($server, SuspensionService::ACTION_SUSPEND);

        return $this->show((string) $server->id);
    }

    public function unsuspend(string $server, SuspensionService $suspension): JsonResponse
    {
        $server = Lookup::server($server);
        $suspension->toggle($server, SuspensionService::ACTION_UNSUSPEND);

        return $this->show((string) $server->id);
    }

    public function reinstall(string $server, ReinstallServerService $reinstall): JsonResponse
    {
        $server = Lookup::server($server);
        $reinstall->handle($server);

        return $this->show((string) $server->id);
    }

    public function power(Request $request, string $server, DaemonPowerRepository $power): Response
    {
        $signal = $request->validate(['signal' => 'required|in:start,stop,restart,kill'])['signal'];
        $power->setServer(Lookup::server($server))->send($signal);

        return response('', 204);
    }

    /**
     * Live usage straight from Wings. Memory, disk and network in bytes, CPU in percent of one
     * core, uptime in milliseconds.
     */
    public function resources(string $server, DaemonServerRepository $daemon): JsonResponse
    {
        $server = Lookup::server($server);

        try {
            $details = $daemon->setServer($server)->getDetails();
        } catch (DaemonConnectionException) {
            throw new HttpException(502, 'The node of this server could not be reached.');
        }

        $stats = $details['utilization'] ?? [];

        return new JsonResponse([
            'state' => $details['state'] ?? $stats['state'] ?? 'offline',
            'suspended' => $server->isSuspended(),
            'cpu' => round((float) ($stats['cpu_absolute'] ?? 0), 2),
            'memory_bytes' => (int) ($stats['memory_bytes'] ?? 0),
            'memory_limit_bytes' => $server->memory * 1024 * 1024,
            'disk_bytes' => (int) ($stats['disk_bytes'] ?? 0),
            'network_rx_bytes' => (int) ($stats['network']['rx_bytes'] ?? 0),
            'network_tx_bytes' => (int) ($stats['network']['tx_bytes'] ?? 0),
            'uptime_ms' => (int) ($stats['uptime'] ?? 0),
        ]);
    }

    public function delete(Request $request, string $server, ServerDeletionService $deletion): Response
    {
        $server = Lookup::server($server);
        $deletion->withForce($request->boolean('force'))->handle($server);

        Activity::event('raptor:server.delete')->property(['uuid' => $server->uuid, 'external_id' => $server->external_id])->log();

        return response('', 204);
    }

    /**
     * "user" is either a reference to an existing user (id, uuid, e-mail or ext:...) or an
     * object that is matched by external_id or e-mail and created when nothing matches.
     *
     * @return array{0: User, 1: bool}
     */
    private function resolveUser(mixed $user, bool $welcome): array
    {
        if (is_string($user) || is_int($user)) {
            return [Lookup::user((string) $user), false];
        }

        validator(['user' => $user], [
            'user' => 'array',
            'user.email' => 'required|email|max:191',
            'user.external_id' => 'nullable|string|max:191',
            'user.username' => 'nullable|string|min:3|max:191',
            'user.first_name' => 'nullable|string|max:191',
            'user.last_name' => 'nullable|string|max:191',
            'user.password' => 'nullable|string|min:8|max:191',
            'user.language' => 'nullable|string|max:5',
        ])->validate();

        return $this->accounts->upsert($user, $welcome);
    }
}
