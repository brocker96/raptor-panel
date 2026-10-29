<?php

namespace Raptor\Services\Support;

use Raptor\Models\User;
use Raptor\Models\SupportTicket;
use Raptor\Models\SupportTicketMessage;

/**
 * Shapes support tickets for the API. Users only see the public profile of staff members,
 * never their email address.
 */
class Presenter
{
    public static function user(?User $user): ?array
    {
        return $user ? [
            'uuid' => $user->uuid,
            'username' => $user->username,
            'name' => trim($user->name_first . ' ' . $user->name_last),
            'avatar_url' => $user->avatar_url,
            'admin' => (bool) $user->root_admin,
        ] : null;
    }

    public static function ticket(SupportTicket $ticket, bool $staff = false): array
    {
        return [
            'id' => $ticket->id,
            'subject' => $ticket->subject,
            'category' => $ticket->category,
            'priority' => $ticket->priority,
            'status' => $ticket->status,
            'server' => $ticket->server ? ['uuid' => $ticket->server->uuid, 'identifier' => $ticket->server->uuidShort, 'name' => $ticket->server->name] : null,
            'user' => $staff ? self::user($ticket->user) + ['email' => $ticket->user->email] : null,
            'assignee' => self::user($ticket->assignee),
            'messages_count' => $ticket->messages_count ?? null,
            'last_message_at' => $ticket->last_message_at?->toAtomString(),
            'closed_at' => $ticket->closed_at?->toAtomString(),
            'created_at' => $ticket->created_at->toAtomString(),
        ];
    }

    public static function ticketMessage(SupportTicketMessage $message): array
    {
        return [
            'id' => $message->id,
            'staff' => $message->staff,
            'body' => $message->body,
            'author' => self::user($message->user),
            'created_at' => $message->created_at->toAtomString(),
        ];
    }
}
