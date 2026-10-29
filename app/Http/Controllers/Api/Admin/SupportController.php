<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Validation\Rule;
use Raptor\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Support\Presenter;
use Raptor\Notifications\SupportTicketUpdated;

class SupportController extends AdminApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::query()->with(['user', 'server', 'assignee'])->withCount('messages');

        $status = $request->query('status', 'active');
        if ($status === 'active') {
            $query->where('status', '!=', SupportTicket::STATUS_CLOSED);
        } elseif (in_array($status, SupportTicket::STATUSES, true)) {
            $query->where('status', $status);
        }
        if ($request->query('mine')) {
            $query->where('assigned_to', $request->user()->id);
        }
        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', $this->like($search))
                    ->orWhere('id', ltrim($search, '#'))
                    ->orWhereHas('user', fn ($u) => $u->where('username', 'like', $this->like($search))->orWhere('email', 'like', $this->like($search)));
            });
        }

        // Waiting tickets first, the most urgent and the oldest wait at the top.
        $query->orderByRaw("FIELD(status, 'open', 'answered', 'closed')")
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'normal', 'low')")
            ->orderBy('last_message_at');

        return $this->paginated($query->paginate($this->perPage($request)), fn (SupportTicket $ticket) => Presenter::ticket($ticket, true));
    }

    public function show(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['user', 'server', 'assignee', 'messages.user']);

        return new JsonResponse(Presenter::ticket($ticket, true) + [
            'messages' => $ticket->messages->map(fn ($message) => Presenter::ticketMessage($message)),
            'staff' => User::query()->where('root_admin', true)->orderBy('username')->get()->map(fn (User $u) => Presenter::user($u)),
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket): JsonResponse
    {
        $body = $request->validate(['message' => 'required|string|min:1|max:10000'])['message'];

        $message = $ticket->reply($request->user(), trim($body), true);
        if (!$ticket->assigned_to) {
            $ticket->forceFill(['assigned_to' => $request->user()->id])->save();
        }

        Activity::event('admin:support.reply')->subject($ticket)->log();

        if (filter_var(config('raptor.support.mail'), FILTER_VALIDATE_BOOLEAN)) {
            $ticket->user->notify(new SupportTicketUpdated($ticket, false));
        }

        return new JsonResponse(Presenter::ticketMessage($message->load('user')), 201);
    }

    public function update(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(SupportTicket::STATUSES)],
            'priority' => ['sometimes', Rule::in(SupportTicket::PRIORITIES)],
            'assigned_to' => ['sometimes', 'nullable', Rule::exists('users', 'uuid')->where('root_admin', true)],
        ]);

        if (array_key_exists('assigned_to', $data)) {
            $data['assigned_to'] = $data['assigned_to'] ? User::query()->where('uuid', $data['assigned_to'])->value('id') : null;
        }
        if (isset($data['status'])) {
            $data['closed_at'] = $data['status'] === SupportTicket::STATUS_CLOSED ? now() : null;
        }

        $ticket->forceFill($data)->save();

        Activity::event('admin:support.update')->subject($ticket)->property($request->only(['status', 'priority', 'assigned_to']))->log();

        return $this->show($ticket);
    }
}
