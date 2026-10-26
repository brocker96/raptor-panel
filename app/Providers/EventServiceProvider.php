<?php

namespace Raptor\Providers;

use Raptor\Models\User;
use Raptor\Models\Server;
use Raptor\Models\Subuser;
use Raptor\Models\EggVariable;
use Raptor\Observers\UserObserver;
use Raptor\Observers\ServerObserver;
use Raptor\Observers\SubuserObserver;
use Raptor\Listeners\TwoFactorListener;
use Raptor\Listeners\RevocationListener;
use Raptor\Observers\EggVariableObserver;
use Raptor\Listeners\AuthenticationListener;
use Raptor\Events\Server\Installed as ServerInstalledEvent;
use Raptor\Notifications\ServerInstalled as ServerInstalledNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     */
    protected $listen = [
        ServerInstalledEvent::class => [ServerInstalledNotification::class],
    ];

    protected $subscribe = [
        AuthenticationListener::class,
        RevocationListener::class,
        TwoFactorListener::class,
    ];

    protected static $shouldDiscoverEvents = false;

    /**
     * Register any events for your application.
     */
    public function boot(): void
    {
        parent::boot();

        User::observe(UserObserver::class);
        Server::observe(ServerObserver::class);
        Subuser::observe(SubuserObserver::class);
        EggVariable::observe(EggVariableObserver::class);
    }
}
