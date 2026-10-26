<?php

namespace Raptor\Repositories\Wings;

use Webmozart\Assert\Assert;
use Raptor\Models\Backup;
use Raptor\Models\Server;
use Psr\Http\Message\ResponseInterface;
use GuzzleHttp\Exception\TransferException;
use Raptor\Exceptions\Http\Connection\DaemonConnectionException;

/**
 * @method \Raptor\Repositories\Wings\DaemonBackupRepository setNode(\Raptor\Models\Node $node)
 * @method \Raptor\Repositories\Wings\DaemonBackupRepository setServer(\Raptor\Models\Server $server)
 */
class DaemonBackupRepository extends DaemonRepository
{
    protected ?string $adapter;

    /**
     * Sets the backup adapter for this execution instance.
     */
    public function setBackupAdapter(string $adapter): self
    {
        $this->adapter = $adapter;

        return $this;
    }

    /**
     * Tells the remote Daemon to begin generating a backup for the server.
     *
     * @throws DaemonConnectionException
     */
    public function backup(Backup $backup): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->post(
                sprintf('/api/servers/%s/backup', $this->server->uuid),
                [
                    'json' => [
                        'adapter' => $this->adapter ?? config('backups.default'),
                        'uuid' => $backup->uuid,
                        'ignore' => implode("\n", $backup->ignored_files),
                    ],
                ]
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }

    /**
     * Sends a request to Wings to begin restoring a backup for a server.
     *
     * @throws DaemonConnectionException
     */
    public function restore(Backup $backup, ?string $url = null, bool $truncate = false): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->post(
                sprintf('/api/servers/%s/backup/%s/restore', $this->server->uuid, $backup->uuid),
                [
                    'json' => [
                        'adapter' => $backup->disk,
                        'truncate_directory' => $truncate,
                        'download_url' => $url ?? '',
                    ],
                ]
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }

    /**
     * Deletes a backup from the daemon.
     *
     * @throws DaemonConnectionException
     */
    public function delete(Backup $backup): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->delete(
                sprintf('/api/servers/%s/backup/%s', $this->server->uuid, $backup->uuid)
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }
}
