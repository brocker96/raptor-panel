<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A server plan: everything needed to create a server except its owner. Billing systems sell
 * packages by slug, the Panel turns one into a server with a single API call.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $description
 * @property bool $active
 * @property int $egg_id
 * @property string|null $image
 * @property string|null $startup
 * @property array|null $environment
 * @property int $memory
 * @property int $swap
 * @property int $disk
 * @property int $io
 * @property int $cpu
 * @property string|null $threads
 * @property bool $oom_disabled
 * @property int $database_limit
 * @property int $allocation_limit
 * @property int $backup_limit
 * @property array|null $location_ids
 * @property array|null $node_ids
 * @property array|null $port_range
 * @property bool $dedicated_ip
 * @property bool $start_on_completion
 * @property array|null $metadata
 * @property int $sort
 * @property Egg $egg
 */
class ServerPackage extends Model
{
    public const RESOURCE_NAME = 'server_package';

    protected $table = 'server_packages';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = [
        'active' => 'boolean',
        'egg_id' => 'integer',
        'environment' => 'array',
        'memory' => 'integer',
        'swap' => 'integer',
        'disk' => 'integer',
        'io' => 'integer',
        'cpu' => 'integer',
        'oom_disabled' => 'boolean',
        'database_limit' => 'integer',
        'allocation_limit' => 'integer',
        'backup_limit' => 'integer',
        'location_ids' => 'array',
        'node_ids' => 'array',
        'port_range' => 'array',
        'dedicated_ip' => 'boolean',
        'start_on_completion' => 'boolean',
        'metadata' => 'array',
        'sort' => 'integer',
    ];

    public static function rules(?self $package = null): array
    {
        $unique = 'unique:server_packages,slug' . ($package ? ',' . $package->id : '');

        return [
            'slug' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9][a-z0-9\-_.]*$/', $unique],
            'name' => 'required|string|max:191',
            'description' => 'nullable|string|max:5000',
            'active' => 'boolean',
            'egg_id' => 'required|integer|exists:eggs,id',
            'image' => 'nullable|string|max:191',
            'startup' => 'nullable|string|max:5000',
            'environment' => 'nullable|array',
            'environment.*' => 'nullable|string|max:2000',
            'memory' => 'required|integer|min:0',
            'swap' => 'integer|min:-1',
            'disk' => 'required|integer|min:0',
            'io' => 'integer|between:10,1000',
            'cpu' => 'integer|min:0',
            'threads' => 'nullable|regex:/^[0-9-,]+$/',
            'oom_disabled' => 'boolean',
            'database_limit' => 'integer|min:0',
            'allocation_limit' => 'integer|min:0',
            'backup_limit' => 'integer|min:0',
            'location_ids' => 'nullable|array',
            'location_ids.*' => 'integer|exists:locations,id',
            'node_ids' => 'nullable|array',
            'node_ids.*' => 'integer|exists:nodes,id',
            'port_range' => 'nullable|array',
            'port_range.*' => ['string', 'regex:/^\d{1,5}(-\d{1,5})?$/'],
            'dedicated_ip' => 'boolean',
            'start_on_completion' => 'boolean',
            'metadata' => 'nullable|array',
            'sort' => 'integer|min:0',
        ];
    }

    public function egg(): BelongsTo
    {
        return $this->belongsTo(Egg::class);
    }

    public function servers(): HasMany
    {
        return $this->hasMany(Server::class, 'package_id');
    }

    /**
     * The values a server built from this package gets, as the server services expect them.
     */
    public function limits(): array
    {
        return [
            'memory' => $this->memory,
            'swap' => $this->swap,
            'disk' => $this->disk,
            'io' => $this->io,
            'cpu' => $this->cpu,
            'threads' => $this->threads,
            'oom_disabled' => $this->oom_disabled,
            'database_limit' => $this->database_limit,
            'allocation_limit' => $this->allocation_limit,
            'backup_limit' => $this->backup_limit,
        ];
    }
}
