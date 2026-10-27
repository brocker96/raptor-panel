<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\Egg;
use Raptor\Models\Nest;
use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\Mount;
use Raptor\Models\Server;
use Carbon\CarbonImmutable;
use Raptor\Models\Database;
use Raptor\Models\Location;
use Raptor\Models\ActivityLog;
use Raptor\Models\DatabaseHost;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Application;

class OverviewController extends AdminApiController
{
    /**
     * Returns the high level statistics rendered on the admin overview page. Everything here is
     * computed with a handful of aggregate queries so that the page stays fast on large panels.
     */
    public function index(): JsonResponse
    {
        $statuses = Server::query()
            ->selectRaw('COALESCE(status, \'installed\') as state, COUNT(*) as total')
            ->groupBy('state')
            ->pluck('total', 'state');

        $nodes = Node::query()
            ->select(['nodes.id', 'nodes.name', 'nodes.fqdn', 'nodes.memory', 'nodes.memory_overallocate', 'nodes.disk', 'nodes.disk_overallocate', 'nodes.maintenance_mode'])
            ->selectRaw('IFNULL(SUM(servers.memory), 0) as allocated_memory, IFNULL(SUM(servers.disk), 0) as allocated_disk, COUNT(servers.id) as servers_count')
            ->leftJoin('servers', 'servers.node_id', '=', 'nodes.id')
            ->groupBy('nodes.id')
            ->orderBy('nodes.id')
            ->limit(50)
            ->get()
            ->map(fn (Node $node) => [
                'id' => $node->id,
                'name' => $node->name,
                'fqdn' => $node->fqdn,
                'maintenance_mode' => $node->maintenance_mode,
                'servers' => (int) $node->getAttribute('servers_count'),
                'memory' => ['used' => (int) $node->getAttribute('allocated_memory'), 'total' => $node->memory, 'overallocate' => (int) $node->memory_overallocate],
                'disk' => ['used' => (int) $node->getAttribute('allocated_disk'), 'total' => $node->disk, 'overallocate' => (int) $node->disk_overallocate],
            ]);

        // Activity over the last 14 days, used for the sparkline on the overview page.
        $since = CarbonImmutable::now()->subDays(13)->startOfDay();
        $activity = ActivityLog::query()
            ->selectRaw('DATE(timestamp) as day, COUNT(*) as total')
            ->where('timestamp', '>=', $since)
            ->groupBy('day')
            ->pluck('total', 'day');

        $days = collect(range(0, 13))->map(function (int $offset) use ($since, $activity) {
            $day = $since->addDays($offset)->toDateString();

            return ['day' => $day, 'total' => (int) ($activity[$day] ?? 0)];
        });

        return new JsonResponse([
            'counts' => [
                'users' => User::query()->count(),
                'admins' => User::query()->where('root_admin', true)->count(),
                'servers' => Server::query()->count(),
                'nodes' => Node::query()->count(),
                'locations' => Location::query()->count(),
                'nests' => Nest::query()->count(),
                'eggs' => Egg::query()->count(),
                'database_hosts' => DatabaseHost::query()->count(),
                'databases' => Database::query()->count(),
                'mounts' => Mount::query()->count(),
                'failed_jobs' => DB::table('failed_jobs')->count(),
            ],
            'servers' => [
                'installed' => (int) ($statuses['installed'] ?? 0),
                'installing' => (int) ($statuses[Server::STATUS_INSTALLING] ?? 0),
                'install_failed' => (int) ($statuses[Server::STATUS_INSTALL_FAILED] ?? 0) + (int) ($statuses[Server::STATUS_REINSTALL_FAILED] ?? 0),
                'suspended' => (int) ($statuses[Server::STATUS_SUSPENDED] ?? 0),
                'restoring_backup' => (int) ($statuses[Server::STATUS_RESTORING_BACKUP] ?? 0),
            ],
            'nodes' => $nodes,
            'activity' => $days,
            'recent_users' => User::query()->latest('id')->limit(5)->get(['id', 'uuid', 'username', 'email', 'root_admin', 'avatar', 'created_at'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'root_admin' => $user->root_admin,
                    'uuid' => $user->uuid,
                    'avatar' => $user->avatar_url,
                    'created_at' => $user->created_at?->toAtomString(),
                ]),
            'recent_servers' => Server::query()->with('node:id,name')->latest('id')->limit(5)->get(['id', 'uuid', 'name', 'node_id', 'status', 'created_at'])
                ->map(fn (Server $server) => [
                    'id' => $server->id,
                    'identifier' => $server->uuidShort,
                    'name' => $server->name,
                    'node' => $server->node?->name,
                    'status' => $server->status,
                    'created_at' => $server->created_at?->toAtomString(),
                ]),
        ]);
    }

    /**
     * Returns information about the environment the Panel is running in, used for the system
     * health card and to help administrators when asking for support.
     */
    public function system(): JsonResponse
    {
        $database = rescue(fn () => DB::selectOne('SELECT VERSION() as version')->version, 'unknown', false);

        $checks = [
            ['key' => 'debug', 'ok' => !config('app.debug'), 'label' => 'Debug mode is disabled', 'hint' => 'APP_DEBUG=true leaks stack traces and secrets to visitors. Set APP_DEBUG=false in your .env file.'],
            ['key' => 'https', 'ok' => str_starts_with(config('app.url'), 'https://'), 'label' => 'Panel URL uses HTTPS', 'hint' => 'Set APP_URL to an https:// address and configure a TLS certificate in your webserver.'],
            ['key' => 'cache', 'ok' => config('cache.default') === 'redis', 'label' => 'Redis is used for cache', 'hint' => 'CACHE_DRIVER=redis is strongly recommended for performance.'],
            ['key' => 'queue', 'ok' => config('queue.default') !== 'sync', 'label' => 'A queue worker is configured', 'hint' => 'QUEUE_CONNECTION=sync runs jobs inside web requests. Use redis and run the raptorq systemd service (created by install.sh).'],
            ['key' => 'session', 'ok' => in_array(config('session.driver'), ['redis', 'database']), 'label' => 'Sessions are stored in Redis or the database', 'hint' => 'File based sessions do not scale and are slower. Use SESSION_DRIVER=redis.'],
            $this->mailCheck(),
            ['key' => 'failed_jobs', 'ok' => DB::table('failed_jobs')->count() === 0, 'label' => 'No failed queue jobs', 'hint' => 'Failed jobs usually mean a node was unreachable or the mail configuration is broken. Review them on the System page.'],
        ];

        return new JsonResponse([
            'panel' => [
                'version' => config('app.version'),
                'environment' => config('app.env'),
                'url' => config('app.url'),
                'timezone' => config('app.timezone'),
                'locale' => config('app.locale'),
                'debug' => (bool) config('app.debug'),
            ],
            'software' => [
                'php' => PHP_VERSION,
                'laravel' => Application::VERSION,
                'database' => $database,
                'os' => php_uname('s') . ' ' . php_uname('r'),
            ],
            'drivers' => [
                'cache' => config('cache.default'),
                'queue' => config('queue.default'),
                'session' => config('session.driver'),
                'mail' => config('mail.default'),
                'filesystem' => config('filesystems.default'),
            ],
            'extensions' => collect(['bcmath', 'curl', 'gd', 'mbstring', 'mysqli', 'openssl', 'pdo_mysql', 'tokenizer', 'xml', 'zip', 'redis', 'intl'])
                ->map(fn (string $ext) => ['name' => $ext, 'loaded' => extension_loaded($ext)]),
            'checks' => $checks,
            'disk' => [
                'free' => rescue(fn () => (int) disk_free_space(base_path()), 0, false),
                'total' => rescue(fn () => (int) disk_total_space(base_path()), 0, false),
            ],
            'releases_url' => 'https://github.com/brocker96/raptor-panel/releases',
        ]);
    }

    private function mailCheck(): array
    {
        $driver = config('mail.default');
        $placeholder = $driver === 'smtp' && str_ends_with((string) config('mail.mailers.smtp.host'), 'example.com');

        return [
            'key' => 'mail',
            'ok' => !in_array($driver, ['log', 'array'], true) && !$placeholder,
            'label' => 'E-mail delivery is configured',
            'hint' => $placeholder
                ? 'The mail settings still point to smtp.example.com, every e-mail fails. Configure your SMTP server in Settings → Mail.'
                : 'E-mails are only written to the log file. Configure an SMTP server in Settings → Mail so users receive password resets.',
        ];
    }
}
