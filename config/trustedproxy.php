<?php

return [
    /*
     * Additional trusted proxy IP addresses, comma separated. Both IPv4 and IPv6 addresses are
     * supported, along with CIDR notation.
     *
     * Loopback addresses and the Cloudflare edge network are always trusted by the Panel (see
     * Raptor\Http\Middleware\TrustProxies), Cloudflare can be turned off in Settings → Cloudflare
     * or with TRUSTED_PROXIES_CLOUDFLARE=false.
     *
     * The "*" character trusts any proxy that connects directly to the server and "**" trusts the
     * entire chain of proxies, use those only if the Panel cannot be reached directly.
     */
    'proxies' => in_array(env('TRUSTED_PROXIES'), ['*', '**'], true)
        ? env('TRUSTED_PROXIES')
        : array_values(array_filter(array_map('trim', explode(',', env('TRUSTED_PROXIES') ?? '')))),
];
