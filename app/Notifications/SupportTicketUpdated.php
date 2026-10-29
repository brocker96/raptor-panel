<?php

namespace Raptor\Notifications;

use Illuminate\Bus\Queueable;
use Raptor\Models\SupportTicket;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Tells administrators about a new ticket and users about an answer from the staff.
 */
class SupportTicketUpdated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public SupportTicket $ticket, public bool $forStaff)
    {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        $subject = "#{$this->ticket->id} {$this->ticket->subject}";

        return $this->forStaff
            ? (new MailMessage())
                ->subject(__('New support ticket: :subject', ['subject' => $subject]))
                ->line(__(':user opened a support ticket.', ['user' => $this->ticket->user->username]))
                ->line($subject)
                ->action(__('Open ticket'), url("/admin/support/{$this->ticket->id}"))
            : (new MailMessage())
                ->subject(__('Support replied: :subject', ['subject' => $subject]))
                ->line(__('The support team answered your ticket.'))
                ->line($subject)
                ->action(__('Open ticket'), url("/account/support/{$this->ticket->id}"));
    }
}
