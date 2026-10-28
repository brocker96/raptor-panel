<?php

namespace Raptor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A WebAuthn credential (passkey or security key) registered by a user.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $credential_id base64url encoded credential id
 * @property string $credential_hash
 * @property string $public_key PEM encoded public key
 * @property int $sign_count
 * @property array|null $transports
 * @property string|null $aaguid
 * @property \Illuminate\Support\Carbon|null $last_used_at
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property User $user
 */
class UserPasskey extends Model
{
    public const RESOURCE_NAME = 'passkey';

    protected $table = 'user_passkeys';

    protected $fillable = [
        'user_id',
        'name',
        'credential_id',
        'credential_hash',
        'public_key',
        'sign_count',
        'transports',
        'aaguid',
        'last_used_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'sign_count' => 'integer',
        'transports' => 'array',
        'last_used_at' => 'datetime',
    ];

    protected $hidden = ['public_key'];

    public static function hashCredentialId(string $credentialId): string
    {
        return hash('sha256', $credentialId);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
