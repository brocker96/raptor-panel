<?php

namespace Raptor\Tests\Unit\Http\Middleware;

use Raptor\Tests\TestCase;
use Raptor\Tests\Traits\Http\RequestMockHelpers;
use Raptor\Tests\Traits\Http\MocksMiddlewareClosure;
use Raptor\Tests\Assertions\MiddlewareAttributeAssertionsTrait;

abstract class MiddlewareTestCase extends TestCase
{
    use MiddlewareAttributeAssertionsTrait;
    use MocksMiddlewareClosure;
    use RequestMockHelpers;

    /**
     * Setup tests with a mocked request object and normal attributes.
     */
    public function setUp(): void
    {
        parent::setUp();

        $this->buildRequestMock();
    }
}
