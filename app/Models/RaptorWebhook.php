<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An endpoint of a billing system that is told about server and user events.
 *
 * @property int $id
 * @property string $url
 * @property string $secret encrypted
 * @property array|null $events null means every event
 * @property bool $active
 * @property string|null $description
 * @property int $failures
 * @property \Illuminate\Support\Carbon|null $last_delivery_at
 */
class RaptorWebhook extends Model
{
    public const EVENTS = [
        'server.created',
        'server.installed',
        'server.install_failed',
        'server.suspended',
        'server.unsuspended',
        'server.package_changed',
        'server.deleted',
        'user.created',
        'user.deleted',
    ];

    protected $table = 'raptor_webhooks';

    protected $fillable = ['url', 'secret', 'events', 'active', 'description'];

    protected $casts = [
        'secret' => 'encrypted',
        'events' => 'array',
        'active' => 'boolean',
        'failures' => 'integer',
        'last_delivery_at' => 'datetime',
    ];

    protected $hidden = ['secret'];

    public function deliveries(): HasMany
    {
        return $this->hasMany(RaptorWebhookDelivery::class, 'webhook_id')->latest('id');
    }

    public function wants(string $event): bool
    {
        return $this->active && (empty($this->events) || in_array($event, $this->events, true));
    }
}
