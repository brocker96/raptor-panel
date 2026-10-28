<?php

namespace Raptor\Services\Security\WebAuthn;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Raptor\Models\UserPasskey;

/**
 * WebAuthn relying party for passkeys and security keys.
 *
 * Attestation is not requested ("none"), so registration trusts the authenticator the way every
 * major website does and only verifies what matters for security: the challenge, the origin, the
 * relying party and, when signing in, the signature made with the registered key.
 */
class WebAuthn
{
    private const FLAG_USER_PRESENT = 0x01;
    private const FLAG_USER_VERIFIED = 0x04;
    private const FLAG_ATTESTED_DATA = 0x40;

    private const CHALLENGE_TTL = 300;

    public function rpId(): string
    {
        return parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost';
    }

    public function origin(): string
    {
        $parts = parse_url((string) config('app.url'));
        $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? 'localhost');

        return isset($parts['port']) ? "$origin:{$parts['port']}" : $origin;
    }

    /**
     * Options for navigator.credentials.create().
     */
    public function registrationOptions(Request $request, User $user): array
    {
        return [
            'challenge' => $this->challenge($request, 'register'),
            'rp' => ['name' => (string) config('app.name', 'Raptor Panel'), 'id' => $this->rpId()],
            'user' => [
                'id' => self::encode(hex2bin(str_replace('-', '', $user->uuid)) ?: $user->uuid),
                'name' => $user->email,
                'displayName' => $user->username,
            ],
            'pubKeyCredParams' => array_map(fn ($alg) => ['type' => 'public-key', 'alg' => $alg], CoseKey::SUPPORTED),
            'timeout' => self::CHALLENGE_TTL * 1000,
            'attestation' => 'none',
            'authenticatorSelection' => [
                'residentKey' => 'preferred',
                'requireResidentKey' => false,
                'userVerification' => 'preferred',
            ],
            'excludeCredentials' => $user->passkeys->map(fn (UserPasskey $key) => [
                'type' => 'public-key',
                'id' => $key->credential_id,
                'transports' => $key->transports ?? [],
            ])->values()->all(),
        ];
    }

    /**
     * Options for navigator.credentials.get(). Without a user any discoverable passkey of this
     * site may answer (passwordless sign in).
     */
    public function assertionOptions(Request $request, string $purpose, ?User $user = null): array
    {
        return [
            'challenge' => $this->challenge($request, $purpose),
            'rpId' => $this->rpId(),
            'timeout' => self::CHALLENGE_TTL * 1000,
            'userVerification' => $user ? 'preferred' : 'required',
            'allowCredentials' => $user ? $user->passkeys->map(fn (UserPasskey $key) => [
                'type' => 'public-key',
                'id' => $key->credential_id,
                'transports' => $key->transports ?? [],
            ])->values()->all() : [],
        ];
    }

    /**
     * Verifies the response of navigator.credentials.create() and returns the attributes of the
     * new passkey.
     *
     * @return array{credential_id: string, credential_hash: string, public_key: string, sign_count: int, aaguid: string|null, transports: array}
     */
    public function verifyRegistration(Request $request, array $credential): array
    {
        $clientDataJson = self::decode($credential['response']['clientDataJSON'] ?? '');
        $this->verifyClientData($request, $clientDataJson, 'webauthn.create', 'register');

        $attestation = Cbor::decode(self::decode($credential['response']['attestationObject'] ?? ''));
        if (!is_array($attestation) || !is_string($attestation['authData'] ?? null)) {
            throw new WebAuthnException(__('The security key returned an invalid response.'));
        }

        $auth = $this->parseAuthenticatorData($attestation['authData']);
        if (!($auth['flags'] & self::FLAG_ATTESTED_DATA) || !isset($auth['credential_id'], $auth['public_key'])) {
            throw new WebAuthnException(__('The security key did not return a credential.'));
        }

        $credentialId = self::encode($auth['credential_id']);
        if (UserPasskey::query()->where('credential_hash', UserPasskey::hashCredentialId($credentialId))->exists()) {
            throw new WebAuthnException(__('This passkey is already registered.'));
        }

        $transports = array_values(array_filter(
            (array) ($credential['response']['transports'] ?? []),
            fn ($value) => is_string($value) && in_array($value, ['usb', 'nfc', 'ble', 'internal', 'hybrid', 'smart-card'], true),
        ));

        return [
            'credential_id' => $credentialId,
            'credential_hash' => UserPasskey::hashCredentialId($credentialId),
            'public_key' => CoseKey::toStorage($auth['public_key']),
            'sign_count' => $auth['sign_count'],
            'aaguid' => $auth['aaguid'],
            'transports' => $transports,
        ];
    }

    /**
     * Verifies the response of navigator.credentials.get() and returns the passkey that signed it.
     */
    public function verifyAssertion(Request $request, array $credential, string $purpose, ?User $user = null): UserPasskey
    {
        $id = (string) ($credential['id'] ?? '');

        /** @var UserPasskey|null $passkey */
        $passkey = UserPasskey::query()->with('user')->where('credential_hash', UserPasskey::hashCredentialId($id))->first();
        if (!$passkey || ($user && $passkey->user_id !== $user->id)) {
            throw new WebAuthnException(__('This passkey is not registered for an account on this Panel.'));
        }

        $clientDataJson = self::decode($credential['response']['clientDataJSON'] ?? '');
        $this->verifyClientData($request, $clientDataJson, 'webauthn.get', $purpose);

        $authenticatorData = self::decode($credential['response']['authenticatorData'] ?? '');
        $auth = $this->parseAuthenticatorData($authenticatorData);

        // Passwordless sign in replaces both factors, so the authenticator must have verified the
        // user (fingerprint, face or device PIN) and not just a touch.
        if ($purpose === 'login' && !($auth['flags'] & self::FLAG_USER_VERIFIED)) {
            throw new WebAuthnException(__('Your passkey did not verify your identity. Use a passkey with a fingerprint, face or PIN unlock.'));
        }

        $signature = self::decode($credential['response']['signature'] ?? '');
        if (!CoseKey::verify($passkey->public_key, $authenticatorData . hash('sha256', $clientDataJson, true), $signature)) {
            throw new WebAuthnException(__('The passkey signature is not valid.'));
        }

        // A counter that does not increase points to a cloned authenticator. Passkeys synced
        // between devices always report 0, which is allowed.
        if ($auth['sign_count'] > 0 || $passkey->sign_count > 0) {
            if ($auth['sign_count'] <= $passkey->sign_count) {
                throw new WebAuthnException(__('This passkey may have been cloned and was rejected.'));
            }
        }

        $passkey->forceFill(['sign_count' => $auth['sign_count'], 'last_used_at' => now()])->save();

        return $passkey;
    }

    public static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    public static function decode(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) {
            throw new WebAuthnException(__('The security key returned an invalid response.'));
        }

        return $decoded;
    }

    private function challenge(Request $request, string $purpose): string
    {
        $challenge = self::encode(random_bytes(32));
        $request->session()->put("webauthn.$purpose", ['challenge' => $challenge, 'expires' => time() + self::CHALLENGE_TTL]);

        return $challenge;
    }

    private function verifyClientData(Request $request, string $json, string $type, string $purpose): void
    {
        $stored = $request->session()->pull("webauthn.$purpose");
        $data = json_decode($json, true);

        if (!is_array($stored) || ($stored['expires'] ?? 0) < time()) {
            throw new WebAuthnException(__('The passkey request expired, please try again.'));
        }

        if (!is_array($data) || ($data['type'] ?? null) !== $type || !hash_equals($stored['challenge'], (string) ($data['challenge'] ?? ''))) {
            throw new WebAuthnException(__('The passkey response does not match this request.'));
        }

        if (($data['origin'] ?? null) !== $this->origin()) {
            throw new WebAuthnException(__('The passkey was used on a different website (:origin).', ['origin' => (string) ($data['origin'] ?? '')]));
        }
    }

    /**
     * @return array{flags: int, sign_count: int, aaguid: string|null, credential_id?: string, public_key?: array}
     */
    private function parseAuthenticatorData(string $data): array
    {
        if (strlen($data) < 37) {
            throw new WebAuthnException(__('The security key returned an invalid response.'));
        }

        if (!hash_equals(hash('sha256', $this->rpId(), true), substr($data, 0, 32))) {
            throw new WebAuthnException(__('The passkey belongs to a different website.'));
        }

        $flags = ord($data[32]);
        if (!($flags & self::FLAG_USER_PRESENT)) {
            throw new WebAuthnException(__('The security key was not touched.'));
        }

        $result = ['flags' => $flags, 'sign_count' => unpack('N', substr($data, 33, 4))[1], 'aaguid' => null];

        if ($flags & self::FLAG_ATTESTED_DATA) {
            if (strlen($data) < 55) {
                throw new WebAuthnException(__('The security key returned an invalid response.'));
            }

            $aaguid = bin2hex(substr($data, 37, 16));
            $result['aaguid'] = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($aaguid, 4));
            $length = unpack('n', substr($data, 53, 2))[1];
            $result['credential_id'] = substr($data, 55, $length);
            if (strlen($result['credential_id']) !== $length || $length > 1023) {
                throw new WebAuthnException(__('The security key returned an invalid response.'));
            }

            $key = Cbor::decode(substr($data, 55 + $length));
            if (!is_array($key)) {
                throw new WebAuthnException(__('The security key returned an invalid response.'));
            }
            $result['public_key'] = $key;
        }

        return $result;
    }
}
