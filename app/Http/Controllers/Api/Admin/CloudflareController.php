<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Node;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Raptor\Helpers\Cloudflare;
use Illuminate\Http\JsonResponse;
use Raptor\Exceptions\DisplayException;
use Illuminate\Contracts\Console\Kernel;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;

class CloudflareController extends AdminApiController
{
    public function __construct(private Kernel $kernel, private SettingsRepositoryInterface $settings)
    {
    }

    /**
     * Returns the Cloudflare settings together with a live diagnosis of the current request and
     * of every node, so that misconfigurations can be spotted at a glance.
     */
    public function index(Request $request): JsonResponse
    {
        $remote = (string) $request->server('REMOTE_ADDR');
        $viaCloudflare = $request->headers->has('CF-Ray') || Cloudflare::contains($remote);

        return new JsonResponse([
            'settings' => [
                'trust_proxies' => filter_var(config('raptor.cloudflare.trust_proxies', true), FILTER_VALIDATE_BOOLEAN),
                'websocket_keepalive' => filter_var(config('raptor.cloudflare.websocket_keepalive', true), FILTER_VALIDATE_BOOLEAN),
            ],
            'ranges' => [
                'list' => Cloudflare::ranges(),
                'custom' => !empty(config('raptor.cloudflare.ranges')),
                'updated_at' => config('raptor.cloudflare.ranges_updated_at') ?: null,
            ],
            'request' => [
                'via_cloudflare' => $viaCloudflare,
                'connecting_address' => $remote,
                'detected_address' => $request->ip(),
                'cf_connecting_ip' => $request->header('CF-Connecting-IP'),
                'cf_ray' => $request->header('CF-Ray'),
                'country' => $request->header('CF-IPCountry'),
                'scheme' => $request->getScheme(),
                'secure' => $request->isSecure(),
            ],
            'panel' => [
                'url' => config('app.url'),
                'https' => str_starts_with(config('app.url'), 'https://'),
            ],
            'nodes' => Node::query()->orderBy('id')->limit(100)->get()->map(fn (Node $node) => $this->analyze($node)),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trust_proxies' => 'required|boolean',
            'websocket_keepalive' => 'required|boolean',
        ]);

        foreach ($data as $key => $value) {
            $this->settings->set("settings::raptor:cloudflare:$key", $value ? 'true' : 'false');
        }

        $this->kernel->call('queue:restart');
        Activity::event('admin:settings.cloudflare')->property($data)->log();

        return new JsonResponse($data);
    }

    public function refresh(): JsonResponse
    {
        try {
            $ranges = Cloudflare::refresh($this->settings);
        } catch (\Throwable $exception) {
            throw new DisplayException('Could not download the Cloudflare IP ranges: ' . $exception->getMessage(), $exception);
        }

        Activity::event('admin:settings.cloudflare-ranges')->property('count', count($ranges))->log();

        return new JsonResponse(['list' => $ranges, 'updated_at' => now()->toAtomString()]);
    }

    /**
     * Checks whether the FQDN of the node points at Cloudflare and if the node configuration
     * works through Cloudflare's proxy.
     */
    private function analyze(Node $node): array
    {
        $addresses = [];
        if (filter_var($node->fqdn, FILTER_VALIDATE_IP)) {
            $addresses = [$node->fqdn];
        } else {
            $records = @dns_get_record($node->fqdn, DNS_A | DNS_AAAA) ?: [];
            foreach ($records as $record) {
                $addresses[] = $record['ip'] ?? $record['ipv6'] ?? null;
            }
            $addresses = array_values(array_filter($addresses));
        }

        $proxied = count($addresses) > 0 && collect($addresses)->every(fn ($ip) => Cloudflare::contains($ip));
        $port = (int) $node->daemonListen;
        $issues = [];

        if (count($addresses) === 0) {
            $issues[] = ['level' => 'error', 'message' => "{$node->fqdn} does not resolve to any address."];
        }

        if ($proxied) {
            $supported = $node->scheme === 'https' ? Cloudflare::HTTPS_PORTS : Cloudflare::HTTP_PORTS;
            if (!in_array($port, $supported)) {
                $issues[] = [
                    'level' => 'error',
                    'message' => sprintf(
                        'Cloudflare does not proxy %s on port %d. Use one of %s or set the record to "DNS only".',
                        strtoupper($node->scheme),
                        $port,
                        implode(', ', $supported),
                    ),
                ];
            }

            $issues[] = [
                'level' => 'warning',
                'message' => "SFTP (port {$node->daemonSFTP}) and game ports cannot pass through Cloudflare's proxy. Give players and SFTP users a \"DNS only\" hostname or the IP address.",
            ];

            if ($node->upload_size > 100) {
                $issues[] = ['level' => 'warning', 'message' => "Upload size is {$node->upload_size} MiB, Cloudflare's free plan rejects requests above 100 MB."];
            }
        }

        if (str_starts_with(config('app.url'), 'https://') && $node->scheme !== 'https') {
            $issues[] = ['level' => 'error', 'message' => 'The Panel uses HTTPS but this node does not, browsers will refuse to open the console websocket.'];
        }

        return [
            'id' => $node->id,
            'name' => $node->name,
            'fqdn' => $node->fqdn,
            'scheme' => $node->scheme,
            'port' => $port,
            'behind_proxy' => $node->behind_proxy,
            'addresses' => $addresses,
            'proxied' => $proxied,
            'issues' => $issues,
        ];
    }
}
