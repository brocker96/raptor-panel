<?php

namespace Raptor\Http\Controllers\Admin\Servers;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Raptor\Models\Nest;
use Raptor\Models\Server;
use Raptor\Exceptions\DisplayException;
use Raptor\Http\Controllers\Controller;
use Raptor\Services\Servers\EnvironmentService;
use Raptor\Repositories\Eloquent\NestRepository;
use Raptor\Repositories\Eloquent\NodeRepository;
use Raptor\Repositories\Eloquent\MountRepository;
use Raptor\Traits\Controllers\JavascriptInjection;
use Raptor\Repositories\Eloquent\LocationRepository;
use Raptor\Repositories\Eloquent\DatabaseHostRepository;

class ServerViewController extends Controller
{
    use JavascriptInjection;

    /**
     * ServerViewController constructor.
     */
    public function __construct(
        private DatabaseHostRepository $databaseHostRepository,
        private LocationRepository $locationRepository,
        private MountRepository $mountRepository,
        private NestRepository $nestRepository,
        private NodeRepository $nodeRepository,
        private EnvironmentService $environmentService,
    ) {
    }

    /**
     * Returns the index view for a server.
     */
    public function index(Request $request, Server $server): View
    {
        return view('admin.servers.view.index', compact('server'));
    }

    /**
     * Returns the server details page.
     */
    public function details(Request $request, Server $server): View
    {
        return view('admin.servers.view.details', compact('server'));
    }

    /**
     * Returns a view of server build settings.
     */
    public function build(Request $request, Server $server): View
    {
        $allocations = $server->node->allocations->toBase();

        return view('admin.servers.view.build', [
            'server' => $server,
            'assigned' => $allocations->where('server_id', $server->id)->sortBy('port')->sortBy('ip'),
            'unassigned' => $allocations->where('server_id', null)->sortBy('port')->sortBy('ip'),
        ]);
    }

    /**
     * Returns the server startup management page.
     *
     * @throws \Raptor\Exceptions\Repository\RecordNotFoundException
     */
    public function startup(Request $request, Server $server): View
    {
        $nests = $this->nestRepository->getWithEggs();
        $variables = $this->environmentService->handle($server);

        $this->plainInject([
            'server' => $server,
            'server_variables' => $variables,
            'nests' => $nests->map(function (Nest $item) {
                return array_merge($item->toArray(), [
                    'eggs' => $item->eggs->keyBy('id')->toArray(),
                ]);
            })->keyBy('id'),
        ]);

        return view('admin.servers.view.startup', compact('server', 'nests'));
    }

    /**
     * Returns all the databases that exist for the server.
     */
    public function database(Request $request, Server $server): View
    {
        return view('admin.servers.view.database', [
            'hosts' => $this->databaseHostRepository->all(),
            'server' => $server,
        ]);
    }

    /**
     * Returns all the mounts that exist for the server.
     */
    public function mounts(Request $request, Server $server): View
    {
        $server->load('mounts');

        return view('admin.servers.view.mounts', [
            'mounts' => $this->mountRepository->getMountListForServer($server),
            'server' => $server,
        ]);
    }

    /**
     * Returns the base server management page, or an exception if the server
     * is in a state that cannot be recovered from.
     *
     * @throws DisplayException
     */
    public function manage(Request $request, Server $server): View
    {
        if ($server->status === Server::STATUS_INSTALL_FAILED) {
            throw new DisplayException('This server is in a failed install state and cannot be recovered. Please delete and re-create the server.');
        }

        // Check if the panel doesn't have at least 2 nodes configured.
        $nodes = $this->nodeRepository->all();
        $canTransfer = false;
        if (count($nodes) >= 2) {
            $canTransfer = true;
        }

        \JavaScript::put([
            'nodeData' => $this->nodeRepository->getNodesForServerCreation(),
        ]);

        return view('admin.servers.view.manage', [
            'server' => $server,
            'locations' => $this->locationRepository->all(),
            'canTransfer' => $canTransfer,
        ]);
    }

    /**
     * Returns the server deletion page.
     */
    public function delete(Request $request, Server $server): View
    {
        return view('admin.servers.view.delete', compact('server'));
    }
}
