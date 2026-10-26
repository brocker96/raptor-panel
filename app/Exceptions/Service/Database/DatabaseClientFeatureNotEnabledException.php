<?php

namespace Raptor\Exceptions\Service\Database;

use Raptor\Exceptions\RaptorException;

class DatabaseClientFeatureNotEnabledException extends RaptorException
{
    public function __construct()
    {
        parent::__construct('Client database creation is not enabled in this Panel.');
    }
}
