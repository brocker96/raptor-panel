<?php

namespace Raptor\Tests\Unit\Services\Updates;

use Raptor\Tests\TestCase;
use Raptor\Services\Updates\ReleaseFeed;

class ReleaseFeedVersionTest extends TestCase
{
    #[\PHPUnit\Framework\Attributes\DataProvider('versionsDataProvider')]
    public function testTagsAreNormalized(?string $tag, ?string $expected)
    {
        $this->assertSame($expected, ReleaseFeed::normalize($tag));
    }

    public static function versionsDataProvider(): array
    {
        return [
            ['v0.6.1', '0.6.1'],
            ['0.6.1', '0.6.1'],
            ['v.0.6.1', '0.6.1'],
            ['v0.5.0-beta', '0.5.0-beta'],
            ['canary', null],
            [null, null],
        ];
    }
}
