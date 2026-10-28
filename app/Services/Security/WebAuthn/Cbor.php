<?php

namespace Raptor\Services\Security\WebAuthn;

/**
 * Minimal CBOR (RFC 8949) decoder covering what WebAuthn uses: integers, byte and text strings,
 * arrays, maps, tags, booleans, null and floats. Indefinite lengths are not used by WebAuthn
 * authenticators and are rejected.
 */
class Cbor
{
    private int $offset = 0;

    private function __construct(private string $data)
    {
    }

    /**
     * Decodes the first item of the buffer. When $consumed is given it receives the number of bytes
     * the item used, which is needed to find data appended after the credential public key.
     */
    public static function decode(string $data, ?int &$consumed = null): mixed
    {
        $decoder = new self($data);
        $value = $decoder->item(0);
        $consumed = $decoder->offset;

        return $value;
    }

    private function item(int $depth): mixed
    {
        if ($depth > 16) {
            throw new WebAuthnException('CBOR data is nested too deeply.');
        }

        $initial = ord($this->read(1));
        $major = $initial >> 5;
        $info = $initial & 0x1F;

        if ($major === 7) {
            return match ($info) {
                20 => false,
                21 => true,
                22, 23 => null,
                25 => $this->halfFloat(),
                26 => unpack('G', $this->read(4))[1],
                27 => unpack('E', $this->read(8))[1],
                default => throw new WebAuthnException('Unsupported CBOR simple value.'),
            };
        }

        $length = $this->length($info);

        return match ($major) {
            0 => $length,
            1 => -1 - $length,
            2, 3 => $this->read($length),
            4 => $this->array($length, $depth),
            5 => $this->map($length, $depth),
            6 => $this->item($depth + 1),
            default => throw new WebAuthnException('Invalid CBOR data.'),
        };
    }

    private function length(int $info): int
    {
        if ($info < 24) {
            return $info;
        }

        $value = match ($info) {
            24 => ord($this->read(1)),
            25 => unpack('n', $this->read(2))[1],
            26 => unpack('N', $this->read(4))[1],
            27 => unpack('J', $this->read(8))[1],
            default => throw new WebAuthnException('Indefinite length CBOR items are not supported.'),
        };

        if ($value < 0) {
            throw new WebAuthnException('CBOR length is out of range.');
        }

        return $value;
    }

    private function array(int $length, int $depth): array
    {
        $items = [];
        for ($i = 0; $i < $length; ++$i) {
            $items[] = $this->item($depth + 1);
        }

        return $items;
    }

    private function map(int $length, int $depth): array
    {
        $items = [];
        for ($i = 0; $i < $length; ++$i) {
            $key = $this->item($depth + 1);
            if (!is_int($key) && !is_string($key)) {
                throw new WebAuthnException('Unsupported CBOR map key.');
            }
            $items[$key] = $this->item($depth + 1);
        }

        return $items;
    }

    private function halfFloat(): float
    {
        $half = unpack('n', $this->read(2))[1];
        $exponent = ($half >> 10) & 0x1F;
        $mantissa = $half & 0x3FF;
        $value = match ($exponent) {
            0 => $mantissa * 2 ** -24,
            31 => $mantissa === 0 ? INF : NAN,
            default => ($mantissa + 1024) * 2 ** ($exponent - 25),
        };

        return ($half & 0x8000) ? -$value : $value;
    }

    private function read(int $length): string
    {
        if ($length < 0 || $this->offset + $length > strlen($this->data)) {
            throw new WebAuthnException('CBOR data ended unexpectedly.');
        }

        $value = substr($this->data, $this->offset, $length);
        $this->offset += $length;

        return $value;
    }
}
