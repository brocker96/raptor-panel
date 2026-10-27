<?php

/*
 * Cloudflare edge networks, see https://www.cloudflare.com/ips/. Requests that arrive from these
 * ranges are trusted to carry the real visitor address in "X-Forwarded-For" and the original
 * scheme in "X-Forwarded-Proto", so the Panel works behind an orange-clouded record without any
 * extra configuration. Set TRUSTED_PROXIES_CLOUDFLARE=false to disable this.
 */
$cloudflare = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
    '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
    '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
    '2a06:98c0::/29', '2c0f:f248::/32',
];

$configured = env('TRUSTED_PROXIES');

return [
    /*
     * Set trusted proxy IP addresses.
     *
     * Both IPv4 and IPv6 addresses are supported, along with CIDR notation. The "*" character
     * trusts any proxy that connects directly to the server and "**" trusts the entire chain of
     * proxies, use those only if the Panel is not reachable from the internet directly.
     *
     * Loopback addresses are always trusted so that a reverse proxy running on the same machine
     * (nginx, Caddy, a Cloudflare Tunnel connector, ...) works out of the box.
     */
    'proxies' => in_array($configured, ['*', '**'], true)
        ? $configured
        : array_values(array_unique(array_filter(array_merge(
            ['127.0.0.1', '::1'],
            filter_var(env('TRUSTED_PROXIES_CLOUDFLARE', true), FILTER_VALIDATE_BOOLEAN) ? $cloudflare : [],
            array_map('trim', explode(',', $configured ?? '')),
        )))),
];
