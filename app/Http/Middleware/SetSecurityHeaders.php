<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;

class SetSecurityHeaders
{
    /**
     * The policy does not limit scripts or styles, custom themes and plugins load those from
     * anywhere. It does stop framing, <base> and plugin tricks and forms posting elsewhere.
     */
    private const CONTENT_SECURITY_POLICY = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

    private static array $headers = [
        'Content-Security-Policy' => self::CONTENT_SECURITY_POLICY,
        'X-Frame-Options' => 'DENY',
        'X-Content-Type-Options' => 'nosniff',
        // The XSS auditor is gone from browsers and could be abused to blank out page parts.
        'X-XSS-Protection' => '0',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy' => 'same-origin',
        // Passkeys need publickey-credentials-*, so only hardware the Panel never uses is denied.
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    ];

    /**
     * Enforces some basic security headers on all responses returned by the software.
     * If a header has already been set in another location within the code it will be
     * skipped over here.
     *
     * @param (\Closure(mixed): \Illuminate\Http\Response) $next
     */
    public function handle(Request $request, \Closure $next): mixed
    {
        $response = $next($request);

        $headers = static::$headers;
        if ($request->isSecure()) {
            // Only over HTTPS, a Panel reached over plain HTTP must not lock itself out.
            $headers['Strict-Transport-Security'] = 'max-age=31536000';
        }

        foreach ($headers as $key => $value) {
            if (! $response->headers->has($key)) {
                $response->headers->set($key, $value);
            }
        }

        return $response;
    }
}
