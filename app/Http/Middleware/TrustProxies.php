<?php

namespace Raptor\Http\Middleware;

use Illuminate\Http\Request;
use Raptor\Helpers\Cloudflare;
use Symfony\Component\HttpFoundation\IpUtils;
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

    /**
     * Cloudflare puts the visitor address in CF-Connecting-IP and only appends to whatever
     * X-Forwarded-For the visitor sent. A Cloudflare Worker can even set X-Forwarded-For
     * freely, so for requests from the edge network only CF-Connecting-IP is believed.
     */
    public function handle(Request $request, \Closure $next)
    {
        $connecting = (string) $request->headers->get('CF-Connecting-IP');
        if (
            filter_var(config('raptor.cloudflare.trust_proxies', true), FILTER_VALIDATE_BOOLEAN)
            && filter_var($connecting, FILTER_VALIDATE_IP) !== false
            && IpUtils::checkIp((string) $request->server->get('REMOTE_ADDR'), Cloudflare::ranges())
        ) {
            $request->headers->set('X-Forwarded-For', $connecting);
        }

        return parent::handle($request, $next);
    }
}
