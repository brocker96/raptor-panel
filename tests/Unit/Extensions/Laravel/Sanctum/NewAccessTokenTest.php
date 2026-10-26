<?php

namespace Raptor\Tests\Unit\Extensions\Laravel\Sanctum;

use Raptor\Models\ApiKey;
use Raptor\Tests\TestCase;
use Illuminate\Contracts\Support\Jsonable;
use Illuminate\Contracts\Support\Arrayable;
use Laravel\Sanctum\NewAccessToken as SanctumAccessToken;
use Raptor\Extensions\Laravel\Sanctum\NewAccessToken;

class NewAccessTokenTest extends TestCase
{
    /**
     * Test that the access token wrapper keeps supporting Sanctum's DTO contract.
     */
    public function testAccessTokenWrapperSupportsSanctumDtoContract()
    {
        $apiKey = ApiKey::factory()->make();
        $token = new NewAccessToken($apiKey, 'plain-text-token');

        $this->assertInstanceOf(Arrayable::class, $token);
        $this->assertInstanceOf(Jsonable::class, $token);
        $this->assertNotInstanceOf(SanctumAccessToken::class, $token);
        $this->assertSame($apiKey, $token->accessToken);
        $this->assertSame('plain-text-token', $token->plainTextToken);
        $this->assertSame([
            'accessToken' => $apiKey,
            'plainTextToken' => 'plain-text-token',
        ], $token->toArray());
        $this->assertSame(json_encode($token->toArray()), $token->toJson());
    }
}
