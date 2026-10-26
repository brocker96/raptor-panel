<?php

namespace Raptor\Http\Controllers\Admin\Nodes;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Raptor\Models\Node;
use Spatie\QueryBuilder\QueryBuilder;
use Raptor\Http\Controllers\Controller;

class NodeController extends Controller
{
    /**
     * Returns a listing of nodes on the system.
     */
    public function index(Request $request): View
    {
        $nodes = QueryBuilder::for(
            Node::query()->with('location')->withCount('servers')
        )
            ->allowedFilters(['uuid', 'name'])
            ->allowedSorts(['id'])
            ->paginate(25);

        return view('admin.nodes.index', ['nodes' => $nodes]);
    }
}
