<?php

namespace Raptor\Helpers;

use IPTools\IP;
use IPTools\Range;
use Illuminate\Support\Facades\Http;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;

class Cloudflare
{
    public const SETTING_RANGES = 'settings::raptor:cloudflare:ranges';

    /**
     * Cloudflare edge networks as published on https://www.cloudflare.com/ips/. Used until the
     * list is refreshed from the admin area, the refreshed list is stored in the settings table.
     */
    public const DEFAULT_RANGES = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
        '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
        '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
        '2a06:98c0::/29', '2c0f:f248::/32',
    ];

    /**
     * Ports Cloudflare proxies HTTPS traffic on, see https://developers.cloudflare.com/fundamentals/reference/network-ports/.
     */
    public const HTTPS_PORTS = [443, 2053, 2083, 2087, 2096, 8443];

    public const HTTP_PORTS = [80, 8080, 8880, 2052, 2082, 2086, 2095];

    /**
     * Returns the Cloudflare ranges, preferring a list refreshed from the admin area.
     */
    public static function ranges(): array
    {
        $stored = config('raptor.cloudflare.ranges');
        if (is_string($stored) && !empty($stored)) {
            $decoded = json_decode($stored, true);
            if (is_array($decoded) && count($decoded) > 0) {
                return $decoded;
            }
        }

        return self::DEFAULT_RANGES;
    }

    /**
     * Downloads the current list of ranges from Cloudflare and stores it.
     */
    public static function refresh(SettingsRepositoryInterface $settings): array
    {
        $ranges = [];
        foreach (['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'] as $url) {
            $body = Http::timeout(10)->get($url)->throw()->body();
            foreach (preg_split('/\s+/', trim($body)) as $range) {
                if (!empty($range) && Range::parse($range)) {
                    $ranges[] = $range;
                }
            }
        }

        if (count($ranges) < 10) {
            throw new \RuntimeException('Cloudflare returned an unexpected list of IP ranges.');
        }

        $settings->set(self::SETTING_RANGES, json_encode($ranges));
        $settings->set('settings::raptor:cloudflare:ranges_updated_at', now()->toAtomString());

        return $ranges;
    }

    /**
     * Determines if the address belongs to Cloudflare.
     */
    public static function contains(string $ip): bool
    {
        try {
            $address = new IP($ip);
        } catch (\Exception) {
            return false;
        }

        foreach (self::ranges() as $range) {
            try {
                if (Range::parse($range)->contains($address)) {
                    return true;
                }
            } catch (\Exception) {
                continue;
            }
        }

        return false;
    }
}
