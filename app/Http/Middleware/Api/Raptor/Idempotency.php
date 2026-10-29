<?php

namespace Raptor\Http\Middleware\Api\Raptor;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Requests with an Idempotency-Key header run once: retrying them (a timeout, a crashed
 * worker, a double click in the shop) returns the first answer instead of doing it again.
 */
class Idempotency
{
    public function handle(Request $request, \Closure $next): mixed
    {
        $key = (string) $request->header('Idempotency-Key');
        if ($key === '' || $request->isMethodSafe()) {
            return $next($request);
        }
        if (strlen($key) > 255) {
            throw new HttpException(422, 'The Idempotency-Key header may be 255 characters at most.');
        }

        $cacheKey = 'raptor:idempotency:' . $request->user()->currentAccessToken()->getKey() . ':' . hash('sha256', $key);
        $fingerprint = hash('sha256', $request->method() . ' ' . $request->path() . ' ' . $request->getContent());

        $lock = Cache::lock($cacheKey . ':lock', 60);
        if (!$lock->get()) {
            throw new HttpException(409, 'A request with this Idempotency-Key is still running.');
        }

        try {
            if (is_array($stored = Cache::get($cacheKey))) {
                if ($stored['fingerprint'] !== $fingerprint) {
                    throw new HttpException(422, 'This Idempotency-Key was already used for a different request.');
                }

                return new Response($stored['body'], $stored['status'], [
                    'Content-Type' => 'application/json',
                    'Idempotent-Replayed' => 'true',
                ]);
            }

            /** @var Response $response */
            $response = $next($request);

            // Server errors are not remembered, the client should be able to try again.
            if ($response->getStatusCode() < 500) {
                Cache::put($cacheKey, [
                    'fingerprint' => $fingerprint,
                    'status' => $response->getStatusCode(),
                    'body' => (string) $response->getContent(),
                ], (int) config('raptor.raptor_api.idempotency_ttl', 86400));
            }

            return $response;
        } finally {
            $lock->release();
        }
    }
}
