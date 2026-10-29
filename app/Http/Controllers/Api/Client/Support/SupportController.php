<?php

namespace Raptor\Http\Controllers\Api\Client\Support;

use Raptor\Models\User;
use Raptor\Models\Server;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Validation\Rule;
use Raptor\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Raptor\Services\Support\Presenter;
use Illuminate\Support\Facades\Notification;
use Raptor\Notifications\SupportTicketUpdated;
use Raptor\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SupportController extends ClientApiController
{
    /**
     * Counters for the navigation badges: tickets waiting for the user, and for administrators
     * the tickets waiting for the staff.
     */
    public function inbox(Request $request): JsonResponse
    {
        $user = $request->user();

        return new JsonResponse([
            'tickets' => SupportTicket::query()->where('user_id', $user->id)->where('status', SupportTicket::STATUS_ANSWERED)->count(),
            'staff_tickets' => $user->root_admin ? SupportTicket::query()->where('status', SupportTicket::STATUS_OPEN)->count() : 0,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tickets = SupportTicket::query()
            ->where('user_id', $request->user()->id)
            ->with(['server', 'assignee'])
            ->withCount('messages')
            ->orderByRaw("status = 'closed'")
            ->latest('last_message_at')
            ->limit(200)
            ->get();

        return new JsonResponse(['data' => $tickets->map(fn (SupportTicket $ticket) => Presenter::ticket($ticket))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|min:3|max:150',
            'category' => ['required', Rule::in(SupportTicket::CATEGORIES)],
            // Urgent is reserved for the staff, everything else is the user's call.
            'priority' => ['required', Rule::in(['low', 'normal', 'high'])],
            'server' => 'nullable|string|uuid',
            'message' => 'required|string|min:1|max:10000',
        ]);

        $server = null;
        if (!empty($data['server'])) {
            $server = $request->user()->accessibleServers()->where('servers.uuid', $data['server'])->first();
            if (!$server instanceof Server) {
                throw new NotFoundHttpException(__('The selected server was not found.'));
            }
        }

        $ticket = DB::transaction(function () use ($request, $data, $server) {
            $ticket = SupportTicket::query()->create([
                'user_id' => $request->user()->id,
                'server_id' => $server?->id,
                'subject' => trim($data['subject']),
                'category' => $data['category'],
                'priority' => $data['priority'],
            ]);
            $ticket->reply($request->user(), trim($data['message']), false);

            return $ticket;
        });

        Activity::event('user:support.create')->subject($ticket)->property('subject', $ticket->subject)->log();

        if (filter_var(config('raptor.support.mail'), FILTER_VALIDATE_BOOLEAN)) {
            Notification::send(User::query()->where('root_admin', true)->get(), new SupportTicketUpdated($ticket, true));
        }

        return $this->show($request, $ticket->id)->setStatusCode(201);
    }

    public function show(Request $request, int $ticket): JsonResponse
    {
        $ticket = $this->find($request, $ticket)->load(['server', 'assignee', 'messages.user']);

        return new JsonResponse(Presenter::ticket($ticket) + [
            'messages' => $ticket->messages->map(fn ($message) => Presenter::ticketMessage($message)),
        ]);
    }

    public function reply(Request $request, int $ticket): JsonResponse
    {
        $body = $request->validate(['message' => 'required|string|min:1|max:10000'])['message'];
        $ticket = $this->find($request, $ticket);

        $message = $ticket->reply($request->user(), trim($body), false);

        return new JsonResponse(Presenter::ticketMessage($message->load('user')), 201);
    }

    public function close(Request $request, int $ticket): JsonResponse
    {
        $ticket = $this->find($request, $ticket);
        $ticket->forceFill(['status' => SupportTicket::STATUS_CLOSED, 'closed_at' => now()])->save();

        Activity::event('user:support.close')->subject($ticket)->log();

        return new JsonResponse(Presenter::ticket($ticket));
    }

    private function find(Request $request, int $id): SupportTicket
    {
        $ticket = SupportTicket::query()->where('user_id', $request->user()->id)->find($id);
        if (!$ticket) {
            throw new NotFoundHttpException(__('This ticket was not found.'));
        }

        return $ticket;
    }
}
