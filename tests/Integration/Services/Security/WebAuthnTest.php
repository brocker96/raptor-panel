<?php

namespace Raptor\Tests\Integration\Services\Security;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Raptor\Models\UserPasskey;
use Raptor\Services\Security\WebAuthn\Cbor;
use Raptor\Services\Security\WebAuthn\WebAuthn;
use Raptor\Tests\Integration\IntegrationTestCase;
use Raptor\Services\Security\WebAuthn\WebAuthnException;

/**
 * Drives the WebAuthn verifier with a software authenticator so registration and sign in are
 * checked end to end for every supported algorithm.
 */
class WebAuthnTest extends IntegrationTestCase
{
    private WebAuthn $webauthn;
    private Request $request;

    public function setUp(): void
    {
        parent::setUp();

        config()->set('app.url', 'https://panel.example.com');

        $this->webauthn = $this->app->make(WebAuthn::class);
        $this->request = Request::create('https://panel.example.com/');
        $this->request->setLaravelSession($this->app['session']->driver('array'));
    }

    public static function algorithms(): array
    {
        return [['es256'], ['eddsa'], ['rs256']];
    }

    /**
     * @dataProvider algorithms
     */
    public function testPasskeysCanBeRegisteredAndUsedToSignIn(string $algorithm): void
    {
        $user = User::factory()->create();
        $authenticator = $this->authenticator($algorithm);

        $passkey = $this->register($user, $authenticator);
        $this->assertSame(0, $passkey->sign_count);
        $this->assertStringStartsWith($algorithm . ':', $passkey->public_key);

        $options = $this->webauthn->assertionOptions($this->request, 'login');
        $this->assertSame('panel.example.com', $options['rpId']);

        $result = $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $options['challenge'], 1), 'login');
        $this->assertTrue($result->is($passkey));
        $this->assertSame(1, $result->refresh()->sign_count);
        $this->assertNotNull($result->last_used_at);
    }

    public function testReplayedChallengesAndCountersAreRejected(): void
    {
        $user = User::factory()->create();
        $authenticator = $this->authenticator('es256');
        $this->register($user, $authenticator);

        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 5), 'login');

        // The challenge is single use.
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 6), 'login'), 'expired');

        // A counter that did not increase points to a cloned authenticator.
        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 5), 'login'), 'cloned');
    }

    public function testResponsesForOtherSitesOrWithBadSignaturesAreRejected(): void
    {
        $user = User::factory()->create();
        $authenticator = $this->authenticator('es256');
        $this->register($user, $authenticator);

        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 1, origin: 'https://evil.example.com'), 'login'), 'different website');

        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 1, rpId: 'evil.example.com'), 'login'), 'different website');

        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $other = $this->authenticator('es256');
        $other['id'] = $authenticator['raw_id'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($other, $challenge, 1), 'login'), 'signature');

        // Passwordless sign in requires user verification, a plain touch is not enough.
        $challenge = $this->webauthn->assertionOptions($this->request, 'login')['challenge'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 1, flags: 0x01), 'login'), 'verify your identity');
    }

    public function testPasskeysOfOtherUsersCannotConfirmActions(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $authenticator = $this->authenticator('es256');
        $this->register($owner, $authenticator);

        $challenge = $this->webauthn->assertionOptions($this->request, 'confirm', $other)['challenge'];
        $this->assertRejected(fn () => $this->webauthn->verifyAssertion($this->request, $this->assertion($authenticator, $challenge, 1), 'confirm', $other), 'not registered');
    }

    public function testTheSameCredentialCannotBeRegisteredTwice(): void
    {
        $user = User::factory()->create();
        $authenticator = $this->authenticator('es256');
        $this->register($user, $authenticator);

        $this->assertRejected(fn () => $this->register($user, $authenticator), 'already registered');
    }

    private function register(User $user, array $authenticator): UserPasskey
    {
        $options = $this->webauthn->registrationOptions($this->request, $user);

        $authData = hash('sha256', 'panel.example.com', true) . chr(0x45) . pack('N', 0)
            . str_repeat("\0", 16) . pack('n', strlen($authenticator['raw_id'])) . $authenticator['raw_id']
            . self::cbor($authenticator['cose']);

        $credential = [
            'id' => WebAuthn::encode($authenticator['raw_id']),
            'response' => [
                'clientDataJSON' => WebAuthn::encode(json_encode([
                    'type' => 'webauthn.create',
                    'challenge' => $options['challenge'],
                    'origin' => 'https://panel.example.com',
                ])),
                'attestationObject' => WebAuthn::encode(self::cbor(['fmt' => 'none', 'attStmt' => [], 'authData' => ['bytes' => $authData]])),
                'transports' => ['internal', 'bogus'],
            ],
        ];

        $attributes = $this->webauthn->verifyRegistration($this->request, $credential);
        $this->assertSame(['internal'], $attributes['transports']);

        return $user->passkeys()->create(['name' => 'Test key'] + $attributes);
    }

    private function assertion(array $authenticator, string $challenge, int $counter, string $origin = 'https://panel.example.com', string $rpId = 'panel.example.com', int $flags = 0x05): array
    {
        $clientData = json_encode(['type' => 'webauthn.get', 'challenge' => $challenge, 'origin' => $origin]);
        $authData = hash('sha256', $rpId, true) . chr($flags) . pack('N', $counter);

        return [
            'id' => WebAuthn::encode($authenticator['id'] ?? $authenticator['raw_id']),
            'response' => [
                'clientDataJSON' => WebAuthn::encode($clientData),
                'authenticatorData' => WebAuthn::encode($authData),
                'signature' => WebAuthn::encode($authenticator['sign']($authData . hash('sha256', $clientData, true))),
            ],
        ];
    }

    private function authenticator(string $algorithm): array
    {
        $id = random_bytes(32);

        if ($algorithm === 'eddsa') {
            $pair = sodium_crypto_sign_keypair();

            return [
                'raw_id' => $id,
                'cose' => [1 => 1, 3 => -8, -1 => 6, -2 => ['bytes' => sodium_crypto_sign_publickey($pair)]],
                'sign' => fn (string $data) => sodium_crypto_sign_detached($data, sodium_crypto_sign_secretkey($pair)),
            ];
        }

        $key = $algorithm === 'es256'
            ? openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'])
            : openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]);
        $details = openssl_pkey_get_details($key);

        $cose = $algorithm === 'es256'
            ? [1 => 2, 3 => -7, -1 => 1, -2 => ['bytes' => str_pad($details['ec']['x'], 32, "\0", STR_PAD_LEFT)], -3 => ['bytes' => str_pad($details['ec']['y'], 32, "\0", STR_PAD_LEFT)]]
            : [1 => 3, 3 => -257, -1 => ['bytes' => $details['rsa']['n']], -2 => ['bytes' => $details['rsa']['e']]];

        return [
            'raw_id' => $id,
            'cose' => $cose,
            'sign' => function (string $data) use ($key) {
                openssl_sign($data, $signature, $key, OPENSSL_ALGO_SHA256);

                return $signature;
            },
        ];
    }

    private function assertRejected(\Closure $callback, string $message): void
    {
        try {
            $callback();
        } catch (WebAuthnException $exception) {
            $this->assertStringContainsString($message, $exception->getMessage());

            return;
        }

        $this->fail('The WebAuthn response was accepted.');
    }

    /**
     * Small CBOR encoder for the test authenticator. Byte strings are passed as ['bytes' => ...].
     */
    private static function cbor(mixed $value): string
    {
        $head = function (int $major, int $length): string {
            return match (true) {
                $length < 24 => chr(($major << 5) | $length),
                $length < 256 => chr(($major << 5) | 24) . chr($length),
                $length < 65536 => chr(($major << 5) | 25) . pack('n', $length),
                default => chr(($major << 5) | 26) . pack('N', $length),
            };
        };

        if (is_int($value)) {
            return $value >= 0 ? $head(0, $value) : $head(1, -1 - $value);
        }

        if (is_string($value)) {
            return $head(3, strlen($value)) . $value;
        }

        if (is_array($value) && array_keys($value) === ['bytes']) {
            return $head(2, strlen($value['bytes'])) . $value['bytes'];
        }

        $encoded = $head(5, count($value));
        foreach ($value as $key => $item) {
            $encoded .= self::cbor($key) . self::cbor($item);
        }

        return $encoded;
    }

    public function testTheCborDecoderReadsWebAuthnStructures(): void
    {
        $data = self::cbor(['fmt' => 'none', 'authData' => ['bytes' => "\x01\x02"], -2 => 7]);
        $decoded = Cbor::decode($data . 'trailing', $consumed);

        $this->assertSame(['fmt' => 'none', 'authData' => "\x01\x02", -2 => 7], $decoded);
        $this->assertSame(strlen($data), $consumed);

        $this->expectException(WebAuthnException::class);
        Cbor::decode("\x5a\xff\xff\xff\xff");
    }
}
