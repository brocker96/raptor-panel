<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Raptor\Http\Controllers\Controller;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

abstract class RaptorController extends Controller
{
    protected function perPage(Request $request): int
    {
        return max(1, min(100, (int) $request->query('per_page', 50)));
    }

    protected function paginated(LengthAwarePaginator $paginator, callable $map): JsonResponse
    {
        return new JsonResponse([
            'data' => collect($paginator->items())->map($map)->values(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
