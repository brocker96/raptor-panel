<?php

namespace Raptor\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Queue\SerializesModels;
use Raptor\Services\RaptorApi\Webhooks;
use Illuminate\Queue\InteractsWithQueue;
use Raptor\Models\RaptorWebhookDelivery;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

/**
 * Posts one webhook delivery. Anything but a 2xx answer is retried with growing pauses, about
 * six hours in total.
 */
class DeliverRaptorWebhook implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 8;

    public function __construct(public int $delivery)
    {
        $this->queue = 'standard';
    }

    public function backoff(): array
    {
        return [10, 60, 300, 900, 1800, 3600, 7200];
    }

    public function handle(): void
    {
        $delivery = RaptorWebhookDelivery::query()->with('webhook')->find($this->delivery);
        if (!$delivery || !$delivery->webhook) {
            return;
        }

        $hook = $delivery->webhook;
        $body = json_encode($delivery->payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $started = microtime(true);
        $status = null;
        $error = null;

        try {
            $response = Http::timeout(10)->connectTimeout(5)->withoutRedirecting()
                ->withHeaders([
                    'User-Agent' => 'Raptor-Panel-Webhooks/1',
                    'X-Raptor-Event' => $delivery->event,
                    'X-Raptor-Delivery' => $delivery->uuid,
                    'X-Raptor-Signature' => Webhooks::signature($hook->secret, $body, time()),
                ])
                ->withBody($body, 'application/json')
                ->post($hook->url);
            $status = $response->status();
            if (!$response->successful()) {
                $error = 'HTTP ' . $status . ': ' . mb_substr(trim($response->body()), 0, 300);
            }
        } catch (\Throwable $exception) {
            $error = mb_substr($exception->getMessage(), 0, 450);
        }

        $delivery->forceFill([
            'status' => $status,
            'error' => $error,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
            'attempts' => $delivery->attempts + 1,
            'delivered_at' => $error ? null : now(),
        ])->save();

        $hook->forceFill(['failures' => $error ? $hook->failures + 1 : 0, 'last_delivery_at' => now()])->save();

        if ($error && $this->attempts() < $this->tries) {
            $this->release($this->backoff()[$this->attempts() - 1] ?? 7200);
        }
    }
}
