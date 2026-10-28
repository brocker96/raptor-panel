<?php

namespace Raptor\Services\Security\WebAuthn;

/**
 * Converts COSE public keys (RFC 9053) from authenticators into a form PHP can verify signatures
 * with: PEM for ECDSA P-256 and RSA, the raw key for Ed25519 (verified with libsodium).
 */
class CoseKey
{
    public const ALG_ES256 = -7;
    public const ALG_EDDSA = -8;
    public const ALG_RS256 = -257;

    private const KTY_OKP = 1;
    private const KTY_EC2 = 2;
    private const KTY_RSA = 3;

    public const SUPPORTED = [self::ALG_ES256, self::ALG_EDDSA, self::ALG_RS256];

    /**
     * Returns the stored representation of the key: "es256:<pem>", "rs256:<pem>" or
     * "eddsa:<base64 key>".
     */
    public static function toStorage(array $cose): string
    {
        $kty = $cose[1] ?? null;
        $alg = $cose[3] ?? null;

        if ($kty === self::KTY_EC2 && $alg === self::ALG_ES256) {
            $x = $cose[-2] ?? '';
            $y = $cose[-3] ?? '';
            if (($cose[-1] ?? null) !== 1 || strlen($x) !== 32 || strlen($y) !== 32) {
                throw new WebAuthnException('Only P-256 elliptic curve keys are supported.');
            }

            // SubjectPublicKeyInfo for id-ecPublicKey / prime256v1 followed by the uncompressed point.
            $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $x . $y;

            return 'es256:' . self::pem($der);
        }

        if ($kty === self::KTY_RSA && $alg === self::ALG_RS256) {
            $n = ltrim($cose[-1] ?? '', "\x00");
            $e = ltrim($cose[-2] ?? '', "\x00");
            if (strlen($n) < 256 || $e === '') {
                throw new WebAuthnException('RSA keys must be at least 2048 bits.');
            }

            $sequence = self::der(0x30, self::integer($n) . self::integer($e));
            $algorithm = hex2bin('300d06092a864886f70d0101010500');
            $der = self::der(0x30, $algorithm . self::der(0x03, "\x00" . $sequence));

            return 'rs256:' . self::pem($der);
        }

        if ($kty === self::KTY_OKP && $alg === self::ALG_EDDSA) {
            $x = $cose[-2] ?? '';
            if (($cose[-1] ?? null) !== 6 || strlen($x) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
                throw new WebAuthnException('Only Ed25519 keys are supported.');
            }

            return 'eddsa:' . base64_encode($x);
        }

        throw new WebAuthnException('This security key uses an unsupported algorithm.');
    }

    /**
     * Verifies a WebAuthn assertion signature with a stored key.
     */
    public static function verify(string $stored, string $data, string $signature): bool
    {
        [$type, $key] = explode(':', $stored, 2) + [null, null];

        return match ($type) {
            'es256', 'rs256' => openssl_verify($data, $signature, $key, OPENSSL_ALGO_SHA256) === 1,
            'eddsa' => strlen($signature) === SODIUM_CRYPTO_SIGN_BYTES
                && sodium_crypto_sign_verify_detached($signature, $data, base64_decode($key)),
            default => false,
        };
    }

    private static function integer(string $bytes): string
    {
        // A leading 0x00 keeps the integer positive when the high bit is set.
        if (ord($bytes[0]) & 0x80) {
            $bytes = "\x00" . $bytes;
        }

        return self::der(0x02, $bytes);
    }

    private static function der(int $tag, string $content): string
    {
        $length = strlen($content);
        if ($length < 0x80) {
            return chr($tag) . chr($length) . $content;
        }

        $encoded = ltrim(pack('N', $length), "\x00");

        return chr($tag) . chr(0x80 | strlen($encoded)) . $encoded . $content;
    }

    private static function pem(string $der): string
    {
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
}
