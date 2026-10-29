<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $webhook_id
 * @property string $uuid
 * @property string $event
 * @property array $payload
 * @property int|null $status
 * @property string|null $error
 * @property int|null $duration_ms
 * @property int $attempts
 * @property \Illuminate\Support\Carbon|null $delivered_at
 * @property \Illuminate\Support\Carbon $created_at
 * @property RaptorWebhook $webhook
 */
class RaptorWebhookDelivery extends Model
{
    protected $table = 'raptor_webhook_deliveries';

    protected $guarded = ['id'];

    protected $casts = [
        'payload' => 'array',
        'status' => 'integer',
        'duration_ms' => 'integer',
        'attempts' => 'integer',
        'delivered_at' => 'datetime',
    ];

    public function webhook(): BelongsTo
    {
        return $this->belongsTo(RaptorWebhook::class, 'webhook_id');
    }
}
