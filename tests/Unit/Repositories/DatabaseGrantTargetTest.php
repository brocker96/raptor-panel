<?php

namespace Raptor\Tests\Unit\Repositories;

use Raptor\Tests\TestCase;
use Raptor\Repositories\Eloquent\DatabaseRepository;

class DatabaseGrantTargetTest extends TestCase
{
    /**
     * MySQL reads "_" and "%" in a GRANT database name as wildcards. Unescaped, the grant on
     * "s1__shop" also covered "s11_shop", a database of another server.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('namesDataProvider')]
    public function testWildcardsAreEscaped(string $name, string $expected)
    {
        $this->assertSame($expected, DatabaseRepository::grantTarget($name));
    }

    public static function namesDataProvider(): array
    {
        return [
            ['s1_shop', '`s1\_shop`'],
            ['s1__shop', '`s1\_\_shop`'],
            ['s1_100%', '`s1\_100\%`'],
            ['s1_a`b', '`s1\_a``b`'],
            ['s1_a\b', '`s1\_a\\\\b`'],
        ];
    }
}
