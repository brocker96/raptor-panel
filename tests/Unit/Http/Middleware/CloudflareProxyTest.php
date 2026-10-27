<?php

namespace Raptor\Tests\Unit\Http\Middleware;

use Raptor\Tests\TestCase;
use Illuminate\Http\Request;
use Raptor\Http\Middleware\TrustProxies;

class CloudflareProxyTest extends TestCase
{
    private function handle(string $remote, array $headers): Request
    {
        $request = Request::create('http://panel.example.com/', 'GET', server: array_merge(['REMOTE_ADDR' => $remote], $headers));

        return (new TrustProxies())->handle($request, fn (Request $request) => $request);
    }

    public function testRealVisitorAddressAndSchemeAreUsedBehindCloudflare(): void
    {
        $request = $this->handle('173.245.48.10', ['HTTP_X_FORWARDED_FOR' => '203.0.113.7', 'HTTP_X_FORWARDED_PROTO' => 'https']);

        $this->assertSame('203.0.113.7', $request->ip());
        $this->assertTrue($request->isSecure());
    }

    public function testForwardedHeadersFromOtherAddressesAreIgnored(): void
    {
        $request = $this->handle('198.51.100.20', ['HTTP_X_FORWARDED_FOR' => '203.0.113.7', 'HTTP_X_FORWARDED_PROTO' => 'https']);

        $this->assertSame('198.51.100.20', $request->ip());
        $this->assertFalse($request->isSecure());
    }

    public function testCloudflareCanBeDisabled(): void
    {
        config()->set('raptor.cloudflare.trust_proxies', false);
        $request = $this->handle('173.245.48.10', ['HTTP_X_FORWARDED_FOR' => '203.0.113.7']);

        $this->assertSame('173.245.48.10', $request->ip());
    }

    public function testRefreshedRangesAreUsed(): void
    {
        config()->set('raptor.cloudflare.ranges', json_encode(['198.18.0.0/15']));

        $this->assertSame('203.0.113.7', $this->handle('198.18.0.5', ['HTTP_X_FORWARDED_FOR' => '203.0.113.7'])->ip());
        $this->assertSame('173.245.48.10', $this->handle('173.245.48.10', ['HTTP_X_FORWARDED_FOR' => '203.0.113.7'])->ip());
    }

    public function testVisitorsCannotSpoofTheirAddressThroughCloudflare(): void
    {
        // Cloudflare appends the real address to whatever the visitor sent.
        $request = $this->handle('173.245.48.10', ['HTTP_X_FORWARDED_FOR' => '10.0.0.1, 203.0.113.7']);

        $this->assertSame('203.0.113.7', $request->ip());
    }
}
