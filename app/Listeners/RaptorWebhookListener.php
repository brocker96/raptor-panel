<?php

namespace Raptor\Listeners;

use Raptor\Events;
use Raptor\Models\Server;
use Raptor\Services\RaptorApi\Webhooks;
use Raptor\Services\RaptorApi\Presenter;
use Illuminate\Contracts\Events\Dispatcher;
use Raptor\Extensions\Illuminate\Events\Contracts\SubscribesToEvents;

/**
 * Turns Panel events into webhook events. They fire whatever caused them: the Raptor API, the
 * admin area or Wings.
 */
class RaptorWebhookListener implements SubscribesToEvents
{
    public function __construct(private Webhooks $webhooks)
    {
    }

    public function created(Events\Server\Created $event): void
    {
        $this->server('server.created', $event->server);
    }

    public function updated(Events\Server\Updated $event): void
    {
        $server = $event->server;
        if ($server->wasChanged('status')) {
            $event = match ($server->status) {
                Server::STATUS_SUSPENDED => 'server.suspended',
                Server::STATUS_INSTALL_FAILED, Server::STATUS_REINSTALL_FAILED => 'server.install_failed',
                // Not the Installed event: that one is skipped when install e-mails are turned off.
                null => match ($server->getOriginal('status')) {
                    Server::STATUS_SUSPENDED => 'server.unsuspended',
                    Server::STATUS_INSTALLING, Server::STATUS_INSTALL_FAILED, Server::STATUS_REINSTALL_FAILED => 'server.installed',
                    default => null,
                },
                default => null,
            };
            if ($event) {
                $this->server($event, $server);
            }
        }

        if ($server->wasChanged('package_id') && $server->package_id) {
            $this->server('server.package_changed', $server);
        }
    }

    public function deleted(Events\Server\Deleted $event): void
    {
        $this->server('server.deleted', $event->server);
    }

    public function userCreated(Events\User\Created $event): void
    {
        $this->webhooks->dispatch('user.created', ['user' => Presenter::user($event->user)]);
    }

    public function userDeleted(Events\User\Deleted $event): void
    {
        $this->webhooks->dispatch('user.deleted', ['user' => Presenter::userSummary($event->user)]);
    }

    private function server(string $event, Server $server): void
    {
        $server->loadMissing(['allocation', 'node', 'user', 'egg', 'package']);

        $this->webhooks->dispatch($event, ['server' => Presenter::server($server)]);
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Events\Server\Created::class, [self::class, 'created']);
        $events->listen(Events\Server\Updated::class, [self::class, 'updated']);
        $events->listen(Events\Server\Deleted::class, [self::class, 'deleted']);
        $events->listen(Events\User\Created::class, [self::class, 'userCreated']);
        $events->listen(Events\User\Deleted::class, [self::class, 'userDeleted']);
    }
}
