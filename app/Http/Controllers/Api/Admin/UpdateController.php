<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Updates\Updater;
use Raptor\Services\Updates\ReleaseFeed;
use Raptor\Services\Updates\UpdateException;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;

class UpdateController extends AdminApiController
{
    public function __construct(
        private ReleaseFeed $feed,
        private Updater $updater,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * Returns the installed version, the releases on GitHub, the update state and the backups.
     */
    public function index(Request $request): JsonResponse
    {
        return new JsonResponse($this->payload($request->boolean('refresh')));
    }

    /**
     * Small payload polled by the admin area while an update runs, also served in maintenance mode.
     */
    public function status(): JsonResponse
    {
        return new JsonResponse([
            'version' => $this->feed->current(),
            'state' => $this->updater->state(),
            'log' => $this->updater->log(),
        ]);
    }

    public function channel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', Rule::in(ReleaseFeed::CHANNELS)],
            'auto_check' => 'sometimes|boolean',
        ]);

        $this->settings->set('settings::raptor:updates:channel', $data['channel']);
        config()->set('raptor.updates.channel', $data['channel']);
        if (array_key_exists('auto_check', $data)) {
            $this->settings->set('settings::raptor:updates:auto_check', $data['auto_check'] ? 'true' : 'false');
            config()->set('raptor.updates.auto_check', $data['auto_check']);
        }

        Activity::event('admin:updates.channel')->property($data)->log();

        return new JsonResponse($this->payload(false));
    }

    public function install(Request $request): JsonResponse
    {
        $data = $request->validate(['version' => 'required|string|max:64']);

        $release = $this->feed->find($data['version']);
        if (!$release || !$release['archive']) {
            throw new UpdateException('That release does not exist or has no panel.tar.gz asset.');
        }

        $this->updater->request('install', $release['version'], $request->user()->username);
        Activity::event('admin:updates.install')->property('version', $release['version'])->log();

        return $this->status();
    }

    public function rollback(Request $request): JsonResponse
    {
        $data = $request->validate(['backup' => 'required|string|max:128']);

        if (!collect($this->updater->backups())->contains('id', $data['backup'])) {
            throw new UpdateException('That backup does not exist.');
        }

        $this->updater->request('rollback', $data['backup'], $request->user()->username);
        Activity::event('admin:updates.rollback')->property('backup', $data['backup'])->log();

        return $this->status();
    }

    public function cancel(): Response
    {
        $this->updater->cancel();

        return response('', 204);
    }

    private function payload(bool $refresh): array
    {
        $error = null;
        $releases = [];
        try {
            $releases = $this->feed->releases($refresh);
        } catch (\Throwable $exception) {
            $error = 'GitHub could not be reached: ' . $exception->getMessage();
        }

        $latest = $error ? null : $this->feed->latest();

        return [
            'current' => $this->feed->current(),
            'development' => $this->feed->isDevelopmentBuild(),
            'repository' => $this->feed->repository(),
            'channel' => $this->feed->channel(),
            'auto_check' => filter_var(config('raptor.updates.auto_check', true), FILTER_VALIDATE_BOOLEAN),
            'latest' => $latest,
            'update_available' => $latest !== null && $this->feed->isNewer($latest),
            'releases' => array_slice($releases, 0, 15),
            'error' => $error,
            'state' => $this->updater->state(),
            'backups' => $this->updater->backups(),
            'php_binary' => PHP_BINARY,
            'base_path' => base_path(),
        ];
    }
}
