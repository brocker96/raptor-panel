<?php

namespace Raptor\Providers;

use Illuminate\Support\ServiceProvider;
use Raptor\Repositories\Eloquent\EggRepository;
use Raptor\Repositories\Eloquent\NestRepository;
use Raptor\Repositories\Eloquent\NodeRepository;
use Raptor\Repositories\Eloquent\TaskRepository;
use Raptor\Repositories\Eloquent\UserRepository;
use Raptor\Repositories\Eloquent\ApiKeyRepository;
use Raptor\Repositories\Eloquent\ServerRepository;
use Raptor\Repositories\Eloquent\SessionRepository;
use Raptor\Repositories\Eloquent\SubuserRepository;
use Raptor\Repositories\Eloquent\DatabaseRepository;
use Raptor\Repositories\Eloquent\LocationRepository;
use Raptor\Repositories\Eloquent\ScheduleRepository;
use Raptor\Repositories\Eloquent\SettingsRepository;
use Raptor\Repositories\Eloquent\AllocationRepository;
use Raptor\Contracts\Repository\EggRepositoryInterface;
use Raptor\Repositories\Eloquent\EggVariableRepository;
use Raptor\Contracts\Repository\NestRepositoryInterface;
use Raptor\Contracts\Repository\NodeRepositoryInterface;
use Raptor\Contracts\Repository\TaskRepositoryInterface;
use Raptor\Contracts\Repository\UserRepositoryInterface;
use Raptor\Repositories\Eloquent\DatabaseHostRepository;
use Raptor\Contracts\Repository\ApiKeyRepositoryInterface;
use Raptor\Contracts\Repository\ServerRepositoryInterface;
use Raptor\Repositories\Eloquent\ServerVariableRepository;
use Raptor\Contracts\Repository\SessionRepositoryInterface;
use Raptor\Contracts\Repository\SubuserRepositoryInterface;
use Raptor\Contracts\Repository\DatabaseRepositoryInterface;
use Raptor\Contracts\Repository\LocationRepositoryInterface;
use Raptor\Contracts\Repository\ScheduleRepositoryInterface;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;
use Raptor\Contracts\Repository\AllocationRepositoryInterface;
use Raptor\Contracts\Repository\EggVariableRepositoryInterface;
use Raptor\Contracts\Repository\DatabaseHostRepositoryInterface;
use Raptor\Contracts\Repository\ServerVariableRepositoryInterface;

class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * Register all the repository bindings.
     */
    public function register(): void
    {
        // Eloquent Repositories
        $this->app->bind(AllocationRepositoryInterface::class, AllocationRepository::class);
        $this->app->bind(ApiKeyRepositoryInterface::class, ApiKeyRepository::class);
        $this->app->bind(DatabaseRepositoryInterface::class, DatabaseRepository::class);
        $this->app->bind(DatabaseHostRepositoryInterface::class, DatabaseHostRepository::class);
        $this->app->bind(EggRepositoryInterface::class, EggRepository::class);
        $this->app->bind(EggVariableRepositoryInterface::class, EggVariableRepository::class);
        $this->app->bind(LocationRepositoryInterface::class, LocationRepository::class);
        $this->app->bind(NestRepositoryInterface::class, NestRepository::class);
        $this->app->bind(NodeRepositoryInterface::class, NodeRepository::class);
        $this->app->bind(ScheduleRepositoryInterface::class, ScheduleRepository::class);
        $this->app->bind(ServerRepositoryInterface::class, ServerRepository::class);
        $this->app->bind(ServerVariableRepositoryInterface::class, ServerVariableRepository::class);
        $this->app->bind(SessionRepositoryInterface::class, SessionRepository::class);
        $this->app->bind(SettingsRepositoryInterface::class, SettingsRepository::class);
        $this->app->bind(SubuserRepositoryInterface::class, SubuserRepository::class);
        $this->app->bind(TaskRepositoryInterface::class, TaskRepository::class);
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    }
}
