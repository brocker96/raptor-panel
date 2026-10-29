<?php

namespace Raptor\Listeners;

use Raptor\Facades\Activity;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Logout;
use Raptor\Events\Auth\DirectLogin;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Contracts\Events\Dispatcher;
use Raptor\Services\Security\SessionManager;
use Raptor\Extensions\Illuminate\Events\Contracts\SubscribesToEvents;

class AuthenticationListener implements SubscribesToEvents
{
    /**
     * Handles an authentication event by logging the user and information about
     * the request.
     */
    public function login(Failed|DirectLogin $event): void
    {
        $activity = Activity::withRequestMetadata();
        if ($event->user) {
            $activity = $activity->subject($event->user);
        }

        if ($event instanceof Failed) {
            foreach ($event->credentials as $key => $value) {
                $activity = $activity->property($key, $value);
            }
        }

        $activity->event($event instanceof Failed ? 'auth:fail' : 'auth:success')->log();
    }

    public function reset(PasswordReset $event): void
    {
        Activity::event('event:password-reset')->withRequestMetadata()->subject($event->user)->log();
    }

    /**
     * Signing out ends the tracked session and forgets the device, so the device cookie
     * cannot sign the browser back in.
     */
    public function logout(Logout $event): void
    {
        $sessions = app(SessionManager::class);
        if ($session = $sessions->current(request())) {
            $sessions->revoke($session, 'logout');
        }

        $sessions->forgetDevice();
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Failed::class, [self::class, 'login']);
        $events->listen(DirectLogin::class, [self::class, 'login']);
        $events->listen(PasswordReset::class, [self::class, 'reset']);
        $events->listen(Logout::class, [self::class, 'logout']);
    }
}
