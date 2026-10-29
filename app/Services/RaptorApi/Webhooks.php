<?php

namespace Raptor\Services\RaptorApi;

use Illuminate\Support\Str;
use Raptor\Models\RaptorWebhook;
use Raptor\Jobs\DeliverRaptorWebhook;
use Raptor\Models\RaptorWebhookDelivery;

/**
 * Tells billing systems what happened. Every delivery is signed and retried, and the last
 * deliveries of every endpoint are kept for Admin → Raptor API.
 */
class Webhooks
{
    /** Deliveries kept per endpoint. */
    private const KEEP = 100;

    public function dispatch(string $event, array $data): void
    {
        // A broken webhook setup must never break the action that triggered it.
        try {
            RaptorWebhook::query()->where('active', true)->get()
                ->filter(fn (RaptorWebhook $hook) => $hook->wants($event))
                ->each(fn (RaptorWebhook $hook) => $this->queue($hook, $event, $data));
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    public function queue(RaptorWebhook $hook, string $event, array $data): RaptorWebhookDelivery
    {
        $uuid = (string) Str::uuid();
        $delivery = $hook->deliveries()->create([
            'uuid' => $uuid,
            'event' => $event,
            'payload' => ['id' => $uuid, 'event' => $event, 'created_at' => now()->toAtomString(), 'data' => $data],
        ]);

        $old = $hook->deliveries()->skip(self::KEEP)->take(1000)->pluck('id');
        if ($old->isNotEmpty()) {
            RaptorWebhookDelivery::query()->whereIn('id', $old)->delete();
        }

        DeliverRaptorWebhook::dispatch($delivery->id);

        return $delivery;
    }

    /**
     * The signature header: "t=<unix time>,v1=<hex HMAC-SHA256 of "<t>.<body>">". Receivers
     * recompute it with their secret and reject old timestamps to stop replays.
     */
    public static function signature(string $secret, string $body, int $timestamp): string
    {
        return 't=' . $timestamp . ',v1=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret);
    }
}
