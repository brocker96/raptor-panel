<?php

namespace Raptor\Tests\Integration\Http\Middleware;

use Raptor\Tests\Integration\Http\HttpTestCase;

class SecurityHeadersTest extends HttpTestCase
{
    public function testSecurityHeadersAreSentWithEveryResponse()
    {
        $response = $this->get('/auth/login');

        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Cross-Origin-Opener-Policy', 'same-origin');
        $this->assertStringContainsString("frame-ancestors 'none'", $response->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString("object-src 'none'", $response->headers->get('Content-Security-Policy'));
        $response->assertHeaderMissing('Strict-Transport-Security');
    }

    public function testStrictTransportSecurityIsOnlySentOverHttps()
    {
        $this->get('https://localhost/auth/login')->assertHeader('Strict-Transport-Security', 'max-age=31536000');
    }
}
