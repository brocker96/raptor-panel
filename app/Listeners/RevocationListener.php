<?php

namespace Raptor\Listeners;

use Raptor\Models\Node;
use Raptor\Events\User\Deleting;
use Raptor\Jobs\RevokeSftpAccessJob;
use Raptor\Events\User\PasswordChanged;
use Raptor\Notifications\SecurityAlert;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Eloquent\Collection;
use Raptor\Services\Security\SessionManager;
use Raptor\Services\Security\TrustedDevices;
use Raptor\Services\Security\SecurityNotifier;
use Raptor\Extensions\Illuminate\Events\Contracts\SubscribesToEvents;

class RevocationListener implements SubscribesToEvents
{
    public function revoke(Deleting|PasswordChanged $event): void
    {
        $user = $event->user;

        // Look at all of the nodes that a user is associated with and trigger a job
        // that disconnects them from websockets and SFTP.
        Node::query()
            ->whereIn('nodes.id', $user->accessibleServers()->select('servers.node_id')->distinct())
            ->chunk(50, function (Collection $nodes) use ($user) {
                $nodes->each(fn (Node $node) => RevokeSftpAccessJob::dispatch($user->uuid, $node));
            });
    }

    /**
     * A new password signs out every other session and forgets trusted devices: whoever knew the
     * old password must not stay signed in.
     */
    public function endSessions(PasswordChanged $event): void
    {
        $sessions = app(SessionManager::class);
        $request = request();
        $current = $request->hasSession() && $request->user()?->id === $event->user->id ? $sessions->current($request) : null;

        $sessions->revokeOthers($event->user, $current, 'password-changed');
        app(TrustedDevices::class)->forgetAll($event->user);
        app(SecurityNotifier::class)->notify($event->user, SecurityAlert::PASSWORD_CHANGED, $request);
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Deleting::class, [self::class, 'revoke']);
        $events->listen(PasswordChanged::class, [self::class, 'revoke']);
        $events->listen(PasswordChanged::class, [self::class, 'endSessions']);
    }
}
