<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Raptor\Http\Controllers\Controller;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Base controller for the admin API. Unlike the application API, responses are plain JSON
 * objects shaped for the React admin area rather than Fractal envelopes.
 */
abstract class AdminApiController extends Controller
{
    /**
     * Returns the number of items per page requested by the client, clamped to a sane range.
     */
    protected function perPage(Request $request, int $default = 25): int
    {
        return max(1, min(100, (int) $request->query('per_page', $default)));
    }

    /**
     * Escapes a user provided value so that it can be safely used inside of a LIKE query.
     */
    protected function like(string $value): string
    {
        return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value) . '%';
    }

    /**
     * Formats a paginator into the response shape expected by the admin data tables.
     */
    protected function paginated(LengthAwarePaginator $paginator, callable $map): JsonResponse
    {
        return new JsonResponse([
            'data' => collect($paginator->items())->map($map)->values(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
