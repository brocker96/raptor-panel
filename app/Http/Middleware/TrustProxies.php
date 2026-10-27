<?php

namespace Raptor\Http\Middleware;

use Raptor\Helpers\Cloudflare;
use Illuminate\Http\Middleware\TrustProxies as Middleware;

class TrustProxies extends Middleware
{
    /**
     * Trusts loopback addresses, the proxies configured with TRUSTED_PROXIES and, unless it was
     * turned off in Settings → Cloudflare, the Cloudflare edge network. Requests arriving from
     * these addresses may set the real visitor address and scheme in the X-Forwarded-* headers.
     */
    protected function proxies()
    {
        $configured = config('trustedproxy.proxies');
        if (in_array($configured, ['*', '**'], true)) {
            return $configured;
        }

        $proxies = array_merge(['127.0.0.1', '::1'], is_array($configured) ? $configured : []);
        if (filter_var(config('raptor.cloudflare.trust_proxies', true), FILTER_VALIDATE_BOOLEAN)) {
            $proxies = array_merge($proxies, Cloudflare::ranges());
        }

        return array_values(array_unique(array_filter($proxies)));
    }
}
