<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A support request from a user, answered by administrators.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $server_id
 * @property int|null $assigned_to
 * @property string $subject
 * @property string $category
 * @property string $priority
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $last_message_at
 * @property \Illuminate\Support\Carbon|null $closed_at
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property User $user
 * @property Server|null $server
 * @property User|null $assignee
 * @property \Illuminate\Database\Eloquent\Collection<int, SupportTicketMessage> $messages
 */
class SupportTicket extends Model
{
    public const RESOURCE_NAME = 'support_ticket';

    public const STATUS_OPEN = 'open';
    public const STATUS_ANSWERED = 'answered';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [self::STATUS_OPEN, self::STATUS_ANSWERED, self::STATUS_CLOSED];
    public const CATEGORIES = ['general', 'technical', 'billing', 'abuse'];
    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    protected $table = 'support_tickets';

    protected $fillable = ['user_id', 'server_id', 'assigned_to', 'subject', 'category', 'priority', 'status', 'last_message_at', 'closed_at'];

    protected $casts = [
        'user_id' => 'integer',
        'server_id' => 'integer',
        'assigned_to' => 'integer',
        'last_message_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class, 'ticket_id')->orderBy('id');
    }

    /**
     * Adds a message and moves the ticket to the side that has to answer next.
     */
    public function reply(User $author, string $body, bool $staff): SupportTicketMessage
    {
        $message = $this->messages()->create(['user_id' => $author->id, 'staff' => $staff, 'body' => $body]);

        $this->forceFill([
            'status' => $staff ? self::STATUS_ANSWERED : self::STATUS_OPEN,
            'last_message_at' => $message->created_at,
            'closed_at' => null,
        ])->save();

        return $message;
    }
}
