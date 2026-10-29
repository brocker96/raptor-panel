<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Hides the support endpoints when the feature was turned off (RAPTOR_SUPPORT).
 */
class SupportEnabled
{
    public function handle(Request $request, \Closure $next): mixed
    {
        if (!filter_var(config('raptor.support.enabled'), FILTER_VALIDATE_BOOLEAN)) {
            throw new NotFoundHttpException();
        }

        return $next($request);
    }
}
