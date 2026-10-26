<?php

namespace Raptor\Http\Controllers\Admin\Nests;

use Illuminate\View\View;
use Raptor\Models\Egg;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Raptor\Http\Controllers\Controller;
use Raptor\Services\Eggs\Scripts\InstallScriptService;
use Raptor\Contracts\Repository\EggRepositoryInterface;
use Raptor\Http\Requests\Admin\Egg\EggScriptFormRequest;

class EggScriptController extends Controller
{
    /**
     * EggScriptController constructor.
     */
    public function __construct(
        protected AlertsMessageBag $alert,
        protected EggRepositoryInterface $repository,
        protected InstallScriptService $installScriptService,
        protected ViewFactory $view,
    ) {
    }

    /**
     * Handle requests to render installation script for an Egg.
     */
    public function index(int $egg): View
    {
        $egg = $this->repository->getWithCopyAttributes($egg);
        $copy = $this->repository->findWhere([
            ['copy_script_from', '=', null],
            ['nest_id', '=', $egg->nest_id],
            ['id', '!=', $egg],
        ]);

        $rely = $this->repository->findWhere([
            ['copy_script_from', '=', $egg->id],
        ]);

        return view('admin.eggs.scripts', [
            'copyFromOptions' => $copy,
            'relyOnScript' => $rely,
            'egg' => $egg,
        ]);
    }

    /**
     * Handle a request to update the installation script for an Egg.
     *
     * @throws \Raptor\Exceptions\Model\DataValidationException
     * @throws \Raptor\Exceptions\Repository\RecordNotFoundException
     * @throws \Raptor\Exceptions\Service\Egg\InvalidCopyFromException
     */
    public function update(EggScriptFormRequest $request, Egg $egg): RedirectResponse
    {
        $this->installScriptService->handle($egg, $request->normalize());
        $this->alert->success(trans('admin/nests.eggs.notices.script_updated'))->flash();

        return redirect()->route('admin.nests.egg.scripts', $egg);
    }
}
