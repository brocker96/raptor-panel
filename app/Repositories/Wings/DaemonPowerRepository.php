<?php

namespace Raptor\Repositories\Wings;

use Raptor\Models\Server;
use Webmozart\Assert\Assert;
use Psr\Http\Message\ResponseInterface;
use GuzzleHttp\Exception\TransferException;
use Raptor\Exceptions\Http\Connection\DaemonConnectionException;

/**
 * @method \Raptor\Repositories\Wings\DaemonPowerRepository setNode(\Raptor\Models\Node $node)
 * @method \Raptor\Repositories\Wings\DaemonPowerRepository setServer(\Raptor\Models\Server $server)
 */
class DaemonPowerRepository extends DaemonRepository
{
    /**
     * Sends a power action to the server instance.
     *
     * @throws DaemonConnectionException
     */
    public function send(string $action): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->post(
                sprintf('/api/servers/%s/power', $this->server->uuid),
                ['json' => ['action' => $action]]
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }
}
