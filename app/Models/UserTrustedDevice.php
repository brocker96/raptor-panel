<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Raptor\Services\Security\UserAgentParser;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A browser on which the user chose to skip the two-factor checkpoint for a while.
 *
 * @property int $id
 * @property int $user_id
 * @property string $token sha256 of the value stored in the cookie
 * @property string $ip
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $last_used_at
 * @property \Illuminate\Support\Carbon $expires_at
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property User $user
 */
class UserTrustedDevice extends Model
{
    use MassPrunable;

    public const RESOURCE_NAME = 'trusted_device';

    protected $table = 'user_trusted_devices';

    protected $fillable = ['user_id', 'token', 'ip', 'user_agent', 'last_used_at', 'expires_at'];

    protected $casts = [
        'user_id' => 'integer',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected $hidden = ['token'];

    public function prunable(): Builder
    {
        return static::query()->where('expires_at', '<', now());
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{browser: string, os: string, type: string}
     */
    public function device(): array
    {
        return UserAgentParser::parse($this->user_agent);
    }
}
