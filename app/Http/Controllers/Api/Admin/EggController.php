<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Egg;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\EggVariable;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Eggs\EggUpdateService;
use Raptor\Services\Eggs\EggCreationService;
use Raptor\Services\Eggs\EggDeletionService;
use Raptor\Http\Requests\Admin\Egg\EggFormRequest;
use Raptor\Services\Eggs\Sharing\EggExporterService;
use Raptor\Services\Eggs\Sharing\EggImporterService;
use Raptor\Services\Eggs\Scripts\InstallScriptService;
use Raptor\Http\Requests\Admin\Egg\EggImportFormRequest;
use Raptor\Http\Requests\Admin\Egg\EggScriptFormRequest;
use Raptor\Services\Eggs\Variables\VariableUpdateService;
use Raptor\Http\Requests\Admin\Egg\EggVariableFormRequest;
use Raptor\Services\Eggs\Sharing\EggUpdateImporterService;
use Raptor\Services\Eggs\Variables\VariableCreationService;

class EggController extends AdminApiController
{
    public function __construct(
        private EggCreationService $creationService,
        private EggDeletionService $deletionService,
        private EggUpdateService $updateService,
        private EggExporterService $exporterService,
        private EggImporterService $importerService,
        private EggUpdateImporterService $updateImporterService,
        private InstallScriptService $installScriptService,
        private VariableCreationService $variableCreationService,
        private VariableUpdateService $variableUpdateService,
    ) {
    }

    public function view(Egg $egg): JsonResponse
    {
        return new JsonResponse($this->format($egg));
    }

    public function store(EggFormRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['docker_images'] = $this->normalizeDockerImages($data['docker_images'] ?? null);

        $egg = $this->creationService->handle($data);

        Activity::event('admin:egg.create')->subject($egg)->property('name', $egg->name)->log();

        return new JsonResponse($this->format($egg), 201);
    }

    public function update(EggFormRequest $request, Egg $egg): JsonResponse
    {
        $data = $request->validated();
        $data['docker_images'] = $this->normalizeDockerImages($data['docker_images'] ?? null);

        $this->updateService->handle($egg, $data);

        Activity::event('admin:egg.update')->subject($egg)->property('name', $egg->name)->log();

        return new JsonResponse($this->format($egg->refresh()));
    }

    public function delete(Egg $egg): Response
    {
        $this->deletionService->handle($egg->id);

        Activity::event('admin:egg.delete')->property('name', $egg->name)->log();

        return response('', 204);
    }

    public function script(EggScriptFormRequest $request, Egg $egg): JsonResponse
    {
        $this->installScriptService->handle($egg, $request->normalize());

        Activity::event('admin:egg.script')->subject($egg)->property('name', $egg->name)->log();

        return new JsonResponse($this->format($egg->refresh()));
    }

    public function export(Egg $egg): Response
    {
        $filename = trim(preg_replace('/\W/', '-', kebab_case($egg->name)), '-');

        return response($this->exporterService->handle($egg->id), 200, [
            'Content-Disposition' => 'attachment; filename=egg-' . $filename . '.json',
            'Content-Type' => 'application/json',
        ]);
    }

    public function import(EggImportFormRequest $request): JsonResponse
    {
        $egg = $this->importerService->handle($request->file('import_file'), (int) $request->input('import_to_nest'));

        Activity::event('admin:egg.import')->subject($egg)->property('name', $egg->name)->log();

        return new JsonResponse($this->format($egg), 201);
    }

    /**
     * Replaces the configuration of an existing egg with the contents of an uploaded egg file,
     * keeping all the servers that already use it.
     */
    public function reimport(EggImportFormRequest $request, Egg $egg): JsonResponse
    {
        $egg = $this->updateImporterService->handle($egg, $request->file('import_file'));

        Activity::event('admin:egg.reimport')->subject($egg)->property('name', $egg->name)->log();

        return new JsonResponse($this->format($egg->refresh()));
    }

    public function storeVariable(EggVariableFormRequest $request, Egg $egg): JsonResponse
    {
        $variable = $this->variableCreationService->handle($egg->id, $request->normalize());

        Activity::event('admin:egg.variable-create')->subject($egg)->property('variable', $variable->env_variable)->log();

        return new JsonResponse($this->formatVariable($variable), 201);
    }

    public function updateVariable(EggVariableFormRequest $request, Egg $egg, EggVariable $variable): JsonResponse
    {
        $this->variableUpdateService->handle($variable, $request->normalize());

        Activity::event('admin:egg.variable-update')->subject($egg)->property('variable', $variable->env_variable)->log();

        return new JsonResponse($this->formatVariable($variable->refresh()));
    }

    public function deleteVariable(Request $request, Egg $egg, EggVariable $variable): Response
    {
        $variable->delete();

        Activity::event('admin:egg.variable-delete')->subject($egg)->property('variable', $variable->env_variable)->log();

        return response('', 204);
    }

    /**
     * Converts the "Display Name|image" textarea format into a name => image mapping.
     */
    private function normalizeDockerImages(?string $input = null): array
    {
        $images = [];
        foreach (array_filter(array_map('trim', explode("\n", $input ?? ''))) as $value) {
            $parts = explode('|', $value, 2);
            $images[$parts[0]] = empty($parts[1]) ? $parts[0] : $parts[1];
        }

        return $images;
    }

    private function formatVariable(EggVariable $variable): array
    {
        return [
            'id' => $variable->id,
            'name' => $variable->name,
            'description' => $variable->description,
            'env_variable' => $variable->env_variable,
            'default_value' => $variable->default_value,
            'user_viewable' => $variable->user_viewable,
            'user_editable' => $variable->user_editable,
            'rules' => $variable->rules,
        ];
    }

    private function format(Egg $egg): array
    {
        $egg->loadMissing(['nest', 'variables', 'configFrom:id,name', 'scriptFrom:id,name'])->loadCount('servers');

        $siblings = Egg::query()->where('nest_id', $egg->nest_id)->where('id', '!=', $egg->id)->orderBy('name')->get(['id', 'name', 'copy_script_from']);

        return [
            'id' => $egg->id,
            'uuid' => $egg->uuid,
            'nest' => ['id' => $egg->nest->id, 'name' => $egg->nest->name],
            'name' => $egg->name,
            'description' => $egg->description,
            'author' => $egg->author,
            'servers' => (int) $egg->servers_count,
            'features' => $egg->features ?? [],
            'file_denylist' => $egg->file_denylist ?? [],
            'force_outgoing_ip' => $egg->force_outgoing_ip,
            'docker_images' => $egg->docker_images,
            'startup' => $egg->startup,
            'config_from' => $egg->config_from,
            'config_stop' => $egg->getRawOriginal('config_stop'),
            'config_startup' => $egg->getRawOriginal('config_startup'),
            'config_logs' => $egg->getRawOriginal('config_logs'),
            'config_files' => $egg->getRawOriginal('config_files'),
            'script' => [
                'install' => $egg->getRawOriginal('script_install'),
                'entry' => $egg->getRawOriginal('script_entry'),
                'container' => $egg->getRawOriginal('script_container'),
                'privileged' => (bool) $egg->getRawOriginal('script_is_privileged'),
                'copy_from' => $egg->copy_script_from,
            ],
            // Eggs in the same nest that configuration and scripts can be inherited from.
            'copy_options' => $siblings->map(fn (Egg $sibling) => ['id' => $sibling->id, 'name' => $sibling->name, 'copyable_script' => is_null($sibling->copy_script_from)])->values(),
            'variables' => $egg->variables->map(fn (EggVariable $variable) => $this->formatVariable($variable))->values(),
            'created_at' => $egg->created_at?->toAtomString(),
            'updated_at' => $egg->updated_at?->toAtomString(),
        ];
    }
}
