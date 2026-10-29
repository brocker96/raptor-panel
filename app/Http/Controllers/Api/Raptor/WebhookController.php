<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Raptor\Models\RaptorWebhook;
use Illuminate\Http\JsonResponse;
use Raptor\Jobs\DeliverRaptorWebhook;
use Raptor\Services\RaptorApi\Webhooks;
use Raptor\Models\RaptorWebhookDelivery;

/**
 * Webhook endpoints, also managed in Admin → Raptor API.
 */
class WebhookController extends RaptorController
{
    public function __construct(private Webhooks $webhooks)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse([
            'data' => RaptorWebhook::query()->orderBy('id')->get()->map(fn (RaptorWebhook $hook) => $this->format($hook)),
            'events' => RaptorWebhook::EVENTS,
        ]);
    }

    /**
     * The secret is generated here and only returned once.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $secret = 'whsec_' . Str::random(40);
        $hook = RaptorWebhook::query()->create($data + ['secret' => $secret, 'active' => $data['active'] ?? true]);

        Activity::event('raptor:webhook.create')->property('url', $hook->url)->log();

        return new JsonResponse($this->format($hook) + ['secret' => $secret], 201);
    }

    public function update(Request $request, RaptorWebhook $webhook): JsonResponse
    {
        $webhook->update($request->validate(collect($this->rules())->map(fn ($rule) => is_array($rule) ? ['sometimes', ...$rule] : 'sometimes|' . $rule)->all()));

        return new JsonResponse($this->format($webhook));
    }

    public function rotate(RaptorWebhook $webhook): JsonResponse
    {
        $secret = 'whsec_' . Str::random(40);
        $webhook->update(['secret' => $secret]);

        return new JsonResponse($this->format($webhook) + ['secret' => $secret]);
    }

    public function delete(RaptorWebhook $webhook): Response
    {
        $webhook->delete();

        return response('', 204);
    }

    /**
     * Sends a "ping" event right away, so a receiver can be tested before going live.
     */
    public function test(RaptorWebhook $webhook): JsonResponse
    {
        $delivery = $this->webhooks->queue($webhook, 'ping', ['message' => 'Hello from ' . config('app.name')]);

        return new JsonResponse($this->delivery($delivery->refresh()), 202);
    }

    public function deliveries(RaptorWebhook $webhook): JsonResponse
    {
        return new JsonResponse(['data' => $webhook->deliveries()->limit(50)->get()->map(fn ($d) => $this->delivery($d))]);
    }

    public function redeliver(RaptorWebhook $webhook, RaptorWebhookDelivery $delivery): JsonResponse
    {
        abort_unless($delivery->webhook_id === $webhook->id, 404);
        DeliverRaptorWebhook::dispatch($delivery->id);

        return new JsonResponse($this->delivery($delivery->refresh()), 202);
    }

    private function rules(): array
    {
        return [
            'url' => ['required', 'url:http,https', 'max:2048'],
            'events' => 'nullable|array',
            'events.*' => ['string', Rule::in(RaptorWebhook::EVENTS)],
            'description' => 'nullable|string|max:191',
            'active' => 'boolean',
        ];
    }

    private function format(RaptorWebhook $hook): array
    {
        return [
            'id' => $hook->id,
            'url' => $hook->url,
            'events' => $hook->events ?? [],
            'description' => $hook->description,
            'active' => $hook->active,
            'failures' => $hook->failures,
            'last_delivery_at' => $hook->last_delivery_at?->toAtomString(),
            'created_at' => $hook->created_at?->toAtomString(),
        ];
    }

    private function delivery(RaptorWebhookDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'uuid' => $delivery->uuid,
            'event' => $delivery->event,
            'status' => $delivery->status,
            'error' => $delivery->error,
            'attempts' => $delivery->attempts,
            'duration_ms' => $delivery->duration_ms,
            'delivered_at' => $delivery->delivered_at?->toAtomString(),
            'created_at' => $delivery->created_at?->toAtomString(),
            'payload' => $delivery->payload,
        ];
    }
}
