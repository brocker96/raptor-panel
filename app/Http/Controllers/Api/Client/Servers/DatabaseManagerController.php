<?php

namespace Raptor\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Response;
use Raptor\Models\Server;
use Raptor\Models\Database;
use Raptor\Facades\Activity;
use Illuminate\Http\JsonResponse;
use Raptor\Exceptions\DisplayException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Raptor\Http\Controllers\Api\Client\ClientApiController;
use Raptor\Services\Databases\Manager\DatabaseManagerService;
use Raptor\Http\Requests\Api\Client\Servers\Databases\ManageDatabaseRequest;

/**
 * Raptor DB Manager, a phpMyAdmin style editor for the databases of a server.
 */
class DatabaseManagerController extends ClientApiController
{
    public function __construct(private DatabaseManagerService $manager)
    {
        parent::__construct();
    }

    public function overview(ManageDatabaseRequest $request, Server $server, Database $database): JsonResponse
    {
        return new JsonResponse($this->manager->overview($database));
    }

    public function structure(ManageDatabaseRequest $request, Server $server, Database $database, string $table): JsonResponse
    {
        return new JsonResponse($this->manager->structure($database, $table));
    }

    public function rows(ManageDatabaseRequest $request, Server $server, Database $database, string $table): JsonResponse
    {
        $options = $request->validate([
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:500',
            'sort' => 'nullable|string|max:64',
            'direction' => 'nullable|in:asc,desc',
            'search' => 'nullable|string|max:255',
            'filters' => 'array|max:10',
            'filters.*.column' => 'required|string|max:64',
            'filters.*.operator' => 'required|in:=,!=,>,<,>=,<=,like,null,not_null',
            'filters.*.value' => 'nullable|string|max:1000',
        ]);

        return new JsonResponse($this->manager->rows($database, $table, $options));
    }

    public function insert(ManageDatabaseRequest $request, Server $server, Database $database, string $table): JsonResponse
    {
        $data = $request->validate(['values' => 'present|array']);

        $id = $this->manager->insert($database, $table, $data['values']);
        $this->log('insert', $database, ['table' => $table]);

        return new JsonResponse(['id' => $id], Response::HTTP_CREATED);
    }

    public function update(ManageDatabaseRequest $request, Server $server, Database $database, string $table): JsonResponse
    {
        $data = $request->validate(['key' => 'required|array', 'values' => 'required|array']);

        $affected = $this->manager->update($database, $table, $data['key'], $data['values']);
        $this->log('update', $database, ['table' => $table]);

        return new JsonResponse(['affected' => $affected]);
    }

    public function delete(ManageDatabaseRequest $request, Server $server, Database $database, string $table): JsonResponse
    {
        $data = $request->validate(['keys' => 'required|array|min:1|max:500', 'keys.*' => 'array']);

        $deleted = $this->manager->delete($database, $table, $data['keys']);
        $this->log('delete', $database, ['table' => $table, 'count' => $deleted]);

        return new JsonResponse(['deleted' => $deleted]);
    }

    public function truncate(ManageDatabaseRequest $request, Server $server, Database $database, string $table): Response
    {
        $this->manager->truncate($database, $table);
        $this->log('truncate', $database, ['table' => $table]);

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function drop(ManageDatabaseRequest $request, Server $server, Database $database, string $table): Response
    {
        $this->manager->drop($database, $table);
        $this->log('drop', $database, ['table' => $table]);

        return new Response('', Response::HTTP_NO_CONTENT);
    }

    public function query(ManageDatabaseRequest $request, Server $server, Database $database): JsonResponse
    {
        $data = $request->validate(['sql' => 'required|string|max:1048576']);

        $results = $this->manager->query($database, $data['sql']);
        $this->log('query', $database, ['sql' => mb_strimwidth($data['sql'], 0, 500, '…')]);

        return new JsonResponse(['results' => $results]);
    }

    public function import(ManageDatabaseRequest $request, Server $server, Database $database): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:' . (int) config('raptor.db_manager.max_import_kb', 51200),
        ]);

        $file = $request->file('file');
        if (!in_array(strtolower($file->getClientOriginalExtension()), ['sql', 'txt'], true)) {
            throw new DisplayException(__('Only .sql files can be imported.'));
        }

        @set_time_limit(0);
        $stream = fopen($file->getRealPath(), 'r');
        try {
            $result = $this->manager->import($database, $stream);
        } finally {
            fclose($stream);
        }

        $this->log('import', $database, ['file' => $file->getClientOriginalName(), 'statements' => $result['executed']]);

        return new JsonResponse($result);
    }

    public function export(ManageDatabaseRequest $request, Server $server, Database $database): StreamedResponse
    {
        $data = $request->validate([
            'tables' => 'array',
            'tables.*' => 'string|max:64',
            'data' => 'boolean',
        ]);

        $this->log('export', $database);

        $name = sprintf('%s-%s.sql', $database->database, now()->format('Y-m-d-His'));

        return new StreamedResponse(function () use ($database, $data) {
            @set_time_limit(0);
            $this->manager->export($database, $data['tables'] ?? [], (bool) ($data['data'] ?? true), function (string $chunk) {
                echo $chunk;
                flush();
            });
        }, 200, [
            'Content-Type' => 'application/sql; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . $name . '"',
            'X-Accel-Buffering' => 'no',
            'Cache-Control' => 'no-store',
        ]);
    }

    private function log(string $event, Database $database, array $properties = []): void
    {
        Activity::event('server:database.manager.' . $event)
            ->subject($database)
            ->property(['name' => $database->database, ...$properties])
            ->log();
    }
}
