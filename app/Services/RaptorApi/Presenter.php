<?php

namespace Raptor\Services\RaptorApi;

use Raptor\Models\Egg;
use Raptor\Models\User;
use Raptor\Models\Server;
use Raptor\Models\ServerPackage;

/**
 * The shapes the Raptor API answers with. Flat, snake_case and stable: billing code written
 * against v1 keeps working.
 */
class Presenter
{
    public static function server(Server $server): array
    {
        $allocation = $server->allocation;

        return [
            'id' => $server->id,
            'uuid' => $server->uuid,
            'identifier' => $server->uuidShort,
            'external_id' => $server->external_id,
            'name' => $server->name,
            'description' => $server->description,
            'state' => self::state($server),
            'package' => $server->package ? ['id' => $server->package->id, 'slug' => $server->package->slug, 'name' => $server->package->name] : null,
            'owner' => $server->user ? self::userSummary($server->user) : null,
            'node' => $server->node ? ['id' => $server->node->id, 'name' => $server->node->name, 'location_id' => $server->node->location_id] : null,
            'address' => $allocation ? [
                'ip' => $allocation->ip,
                'alias' => $allocation->ip_alias,
                'port' => $allocation->port,
                'display' => ($allocation->ip_alias ?: $allocation->ip) . ':' . $allocation->port,
            ] : null,
            'limits' => [
                'memory' => $server->memory,
                'swap' => $server->swap,
                'disk' => $server->disk,
                'io' => $server->io,
                'cpu' => $server->cpu,
                'threads' => $server->threads,
                'oom_disabled' => (bool) $server->oom_disabled,
            ],
            'feature_limits' => [
                'databases' => $server->database_limit,
                'allocations' => $server->allocation_limit,
                'backups' => $server->backup_limit,
            ],
            'egg' => ['id' => $server->egg_id, 'name' => $server->egg?->name],
            'panel_url' => url('/server/' . $server->uuidShort),
            'installed_at' => $server->installed_at?->toAtomString(),
            'created_at' => $server->created_at?->toAtomString(),
            'updated_at' => $server->updated_at?->toAtomString(),
        ];
    }

    /**
     * One word a billing system can switch on, instead of the Panel's nullable status.
     */
    public static function state(Server $server): string
    {
        return $server->status ?? 'active';
    }

    public static function userSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'external_id' => $user->external_id,
            'username' => $user->username,
            'email' => $user->email,
        ];
    }

    public static function user(User $user): array
    {
        return self::userSummary($user) + [
            'first_name' => $user->name_first,
            'last_name' => $user->name_last,
            'language' => $user->language,
            'admin' => (bool) $user->root_admin,
            '2fa' => (bool) $user->use_totp,
            'servers_count' => $user->servers_count ?? $user->servers()->count(),
            'created_at' => $user->created_at?->toAtomString(),
        ];
    }

    public static function package(ServerPackage $package): array
    {
        return [
            'id' => $package->id,
            'slug' => $package->slug,
            'name' => $package->name,
            'description' => $package->description,
            'active' => $package->active,
            'egg' => ['id' => $package->egg_id, 'name' => $package->egg?->name, 'nest_id' => $package->egg?->nest_id],
            'image' => $package->image,
            'startup' => $package->startup,
            'environment' => (object) ($package->environment ?? []),
            'limits' => [
                'memory' => $package->memory,
                'swap' => $package->swap,
                'disk' => $package->disk,
                'io' => $package->io,
                'cpu' => $package->cpu,
                'threads' => $package->threads,
                'oom_disabled' => $package->oom_disabled,
            ],
            'feature_limits' => [
                'databases' => $package->database_limit,
                'allocations' => $package->allocation_limit,
                'backups' => $package->backup_limit,
            ],
            'deploy' => [
                'location_ids' => $package->location_ids ?? [],
                'node_ids' => $package->node_ids ?? [],
                'port_range' => $package->port_range ?? [],
                'dedicated_ip' => $package->dedicated_ip,
                'start_on_completion' => $package->start_on_completion,
            ],
            'metadata' => (object) ($package->metadata ?? []),
            'sort' => $package->sort,
            'servers_count' => $package->servers_count ?? null,
            'created_at' => $package->created_at?->toAtomString(),
            'updated_at' => $package->updated_at?->toAtomString(),
        ];
    }

    public static function egg(Egg $egg): array
    {
        return [
            'id' => $egg->id,
            'nest' => ['id' => $egg->nest_id, 'name' => $egg->nest?->name],
            'name' => $egg->name,
            'description' => $egg->description,
            'docker_images' => $egg->docker_images,
            'startup' => $egg->startup,
            'variables' => $egg->variables->map(fn ($v) => [
                'env' => $v->env_variable,
                'name' => $v->name,
                'default' => $v->default_value,
                'rules' => $v->rules,
                'user_editable' => (bool) $v->user_editable,
            ])->values(),
        ];
    }
}
