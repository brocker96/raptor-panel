<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Raptor\Services\Security\UserAgentParser;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A signed in browser of a user. Every login creates one, so that the user can see where they
 * are signed in and end any of those sessions from the Security page.
 *
 * @property int $id
 * @property int $user_id
 * @property string $identifier
 * @property string|null $device_token
 * @property bool $remember
 * @property string $method
 * @property string $ip
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $last_active_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $revoked_at
 * @property string|null $revoked_reason
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property User $user
 */
class UserSession extends Model
{
    use MassPrunable;

    public const RESOURCE_NAME = 'user_session';

    protected $table = 'user_sessions';

    protected $fillable = [
        'user_id',
        'identifier',
        'device_token',
        'remember',
        'method',
        'ip',
        'user_agent',
        'last_active_at',
        'expires_at',
        'revoked_at',
        'revoked_reason',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'remember' => 'boolean',
        'last_active_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    protected $hidden = ['device_token'];

    /**
     * Ended and expired sessions are kept for a month so the list of recent sessions stays useful.
     */
    public function prunable(): Builder
    {
        return static::query()->where(function (Builder $query) {
            $query->where('revoked_at', '<', now()->subDays(30))
                ->orWhere('expires_at', '<', now()->subDays(30));
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Sessions that have not been ended and did not expire yet.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at')->where(function (Builder $query) {
            $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
        });
    }

    public function isActive(): bool
    {
        return is_null($this->revoked_at) && (is_null($this->expires_at) || $this->expires_at->isFuture());
    }

    /**
     * @return array{browser: string, os: string, type: string}
     */
    public function device(): array
    {
        return UserAgentParser::parse($this->user_agent);
    }
}
