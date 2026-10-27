<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Database;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\DatabaseHost;
use Illuminate\Http\JsonResponse;
use Raptor\Exceptions\DisplayException;
use Raptor\Services\Databases\Hosts\HostUpdateService;
use Raptor\Http\Requests\Admin\DatabaseHostFormRequest;
use Raptor\Services\Databases\Hosts\HostCreationService;
use Raptor\Services\Databases\Hosts\HostDeletionService;

class DatabaseHostController extends AdminApiController
{
    public function __construct(
        private HostCreationService $creationService,
        private HostDeletionService $deletionService,
        private HostUpdateService $updateService,
    ) {
    }

    public function index(): JsonResponse
    {
        $hosts = DatabaseHost::query()->with('node:id,name')->withCount('databases')->orderBy('id')->get();

        return new JsonResponse(['data' => $hosts->map(fn (DatabaseHost $host) => $this->format($host))]);
    }

    public function view(DatabaseHost $host): JsonResponse
    {
        $host->load('node:id,name')->loadCount('databases');

        $databases = Database::query()
            ->with('server:id,uuid,name')
            ->where('database_host_id', $host->id)
            ->orderBy('id')
            ->get()
            ->map(fn (Database $database) => [
                'id' => $database->id,
                'database' => $database->database,
                'username' => $database->username,
                'remote' => $database->remote,
                'max_connections' => $database->max_connections,
                'server' => $database->server ? ['id' => $database->server->id, 'name' => $database->server->name, 'identifier' => $database->server->uuidShort] : null,
            ]);

        return new JsonResponse(['host' => $this->format($host), 'databases' => $databases]);
    }

    public function store(DatabaseHostFormRequest $request): JsonResponse
    {
        $host = $this->guard(fn () => $this->creationService->handle($request->normalize()));

        Activity::event('admin:database-host.create')->subject($host)->property('name', $host->name)->log();

        return new JsonResponse($this->format($host->load('node:id,name')->loadCount('databases')), 201);
    }

    public function update(DatabaseHostFormRequest $request, DatabaseHost $host): JsonResponse
    {
        $data = $request->normalize();
        // An empty password keeps the currently stored password.
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $host = $this->guard(fn () => $this->updateService->handle($host->id, $data));

        Activity::event('admin:database-host.update')->subject($host)->property('name', $host->name)->log();

        return new JsonResponse($this->format($host->load('node:id,name')->loadCount('databases')));
    }

    public function delete(DatabaseHost $host): Response
    {
        $this->deletionService->handle($host->id);

        Activity::event('admin:database-host.delete')->property('name', $host->name)->log();

        return response('', 204);
    }

    /**
     * Runs the callback and converts database connection failures into an error message that
     * can be shown to the administrator instead of a generic server error.
     */
    private function guard(\Closure $callback): DatabaseHost
    {
        try {
            return $callback();
        } catch (\Exception $exception) {
            if ($exception instanceof \PDOException || $exception->getPrevious() instanceof \PDOException) {
                throw new DisplayException(sprintf('Could not connect to the database host or run a query on it: %s', $exception->getMessage()), $exception);
            }

            throw $exception;
        }
    }

    private function format(DatabaseHost $host): array
    {
        return [
            'id' => $host->id,
            'name' => $host->name,
            'host' => $host->host,
            'port' => $host->port,
            'username' => $host->username,
            'max_databases' => $host->max_databases,
            'node' => $host->node ? ['id' => $host->node->id, 'name' => $host->node->name] : null,
            'databases' => (int) ($host->databases_count ?? 0),
            'created_at' => $host->created_at?->toAtomString(),
        ];
    }
}
