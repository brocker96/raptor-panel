<?php

namespace Raptor\Services\Updates;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Contracts\Cache\Repository as CacheRepository;

/**
 * Reads the releases of the Raptor Panel repository from GitHub and works out whether a newer
 * version than the installed one is available on the selected channel.
 */
class ReleaseFeed
{
    public const CACHE_KEY = 'raptor:updates:releases';

    public const CHANNELS = ['stable', 'beta'];

    public function __construct(private CacheRepository $cache)
    {
    }

    public function repository(): string
    {
        return (string) config('raptor.updates.repository', 'brocker96/raptor-panel');
    }

    public function channel(): string
    {
        $channel = (string) config('raptor.updates.channel', 'beta');

        return in_array($channel, self::CHANNELS, true) ? $channel : 'beta';
    }

    /**
     * The installed version, "canary" for installations made from a git branch.
     */
    public function current(): string
    {
        return (string) config('app.version');
    }

    public function isDevelopmentBuild(): bool
    {
        return self::normalize($this->current()) === null;
    }

    /**
     * Returns the published releases, newest first. Results are cached for an hour so that the
     * unauthenticated GitHub API limit is never reached.
     *
     * @return array<int, array<string, mixed>>
     */
    public function releases(bool $fresh = false): array
    {
        if ($fresh) {
            $this->cache->forget(self::CACHE_KEY);
        }

        return $this->cache->remember(self::CACHE_KEY, now()->addHour(), function () {
            $response = Http::withHeaders([
                'Accept' => 'application/vnd.github+json',
                'User-Agent' => 'Raptor-Panel/' . $this->current(),
            ])
                ->timeout(10)
                ->get(config('raptor.updates.feed') ?: sprintf('https://api.github.com/repos/%s/releases', $this->repository()), ['per_page' => 30])
                ->throw()
                ->json();

            return collect(is_array($response) ? $response : [])
                ->filter(fn ($release) => is_array($release) && !($release['draft'] ?? false))
                ->map(fn (array $release) => $this->format($release))
                ->filter(fn (array $release) => $release['version'] !== null)
                ->sort(fn (array $a, array $b) => version_compare($b['version'], $a['version']))
                ->values()
                ->all();
        });
    }

    /**
     * Returns the newest release on the selected channel.
     */
    public function latest(bool $fresh = false): ?array
    {
        return collect($this->releases($fresh))
            ->first(fn (array $release) => $this->channel() === 'beta' || !$release['prerelease']);
    }

    /**
     * Whether the release is newer than the installed version. Every release is considered newer
     * than a development build so that those installations can move to a tagged version.
     */
    public function isNewer(array $release): bool
    {
        $current = self::normalize($this->current());

        return $current === null || version_compare($release['version'], $current, '>');
    }

    public function find(string $version): ?array
    {
        $version = self::normalize($version);

        return collect($this->releases())->first(fn (array $release) => $release['version'] === $version);
    }

    /**
     * Turns "v1.2.0" into "1.2.0" and returns null for anything that is not a version number.
     */
    public static function normalize(?string $version): ?string
    {
        $version = ltrim(trim((string) $version), 'vV');

        return preg_match('/^\d+\.\d+(\.\d+)?([-.+][0-9A-Za-z.-]+)?$/', $version) ? $version : null;
    }

    private function format(array $release): array
    {
        $assets = collect($release['assets'] ?? []);
        $asset = fn (string $name) => Arr::get($assets->firstWhere('name', $name) ?? [], 'browser_download_url');

        return [
            'version' => self::normalize($release['tag_name'] ?? null),
            'tag' => $release['tag_name'] ?? null,
            'name' => $release['name'] ?: ($release['tag_name'] ?? null),
            'prerelease' => (bool) ($release['prerelease'] ?? false),
            'published_at' => $release['published_at'] ?? null,
            'url' => $release['html_url'] ?? null,
            'notes' => mb_substr((string) ($release['body'] ?? ''), 0, 20000),
            'archive' => $asset('panel.tar.gz'),
            'checksum' => $asset('panel.tar.gz.sha256'),
        ];
    }
}
