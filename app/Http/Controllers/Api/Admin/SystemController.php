<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Console\Kernel;

class SystemController extends AdminApiController
{
    public function __construct(private Kernel $kernel)
    {
    }

    /**
     * Lists queue jobs that failed, which usually point at unreachable nodes or a broken mail
     * configuration.
     */
    public function failedJobs(Request $request): JsonResponse
    {
        $jobs = DB::table('failed_jobs')->orderByDesc('id')->paginate($this->perPage($request));

        return $this->paginated($jobs, function ($job) {
            $payload = json_decode($job->payload, true) ?? [];

            return [
                'id' => $job->id,
                'uuid' => $job->uuid,
                'queue' => $job->queue,
                'job' => class_basename($payload['displayName'] ?? 'Unknown'),
                'exception' => Str::limit(strtok($job->exception, "\n") ?: '', 500),
                'trace' => Str::limit($job->exception, 6000),
                // Stored without a timezone, in the timezone of the Panel.
                'failed_at' => CarbonImmutable::parse($job->failed_at, config('app.timezone'))->toAtomString(),
            ];
        });
    }

    public function retry(string $uuid): Response
    {
        $this->kernel->call('queue:retry', ['id' => [$uuid]]);

        Activity::event('admin:system.job-retry')->property('uuid', $uuid)->log();

        return response('', 204);
    }

    public function forget(string $uuid): Response
    {
        DB::table('failed_jobs')->where('uuid', $uuid)->delete();

        return response('', 204);
    }

    public function flush(): Response
    {
        DB::table('failed_jobs')->delete();

        Activity::event('admin:system.jobs-flush')->log();

        return response('', 204);
    }

    /**
     * Clears the configuration, route and view caches. Useful after editing the .env file.
     */
    public function clearCache(): Response
    {
        foreach (['config:clear', 'route:clear', 'view:clear'] as $command) {
            $this->kernel->call($command);
        }

        Activity::event('admin:system.cache-clear')->log();

        return response('', 204);
    }
}
