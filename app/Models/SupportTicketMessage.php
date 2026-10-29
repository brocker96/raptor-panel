<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $ticket_id
 * @property int|null $user_id
 * @property bool $staff
 * @property string $body
 * @property \Illuminate\Support\Carbon $created_at
 * @property User|null $user
 */
class SupportTicketMessage extends Model
{
    protected $table = 'support_ticket_messages';

    protected $fillable = ['user_id', 'staff', 'body'];

    protected $casts = ['user_id' => 'integer', 'staff' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
