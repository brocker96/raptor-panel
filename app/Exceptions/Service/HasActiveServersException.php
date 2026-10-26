<?php

namespace Raptor\Exceptions\Service;

use Illuminate\Http\Response;
use Raptor\Exceptions\DisplayException;

class HasActiveServersException extends DisplayException
{
    public function getStatusCode(): int
    {
        return Response::HTTP_BAD_REQUEST;
    }
}
