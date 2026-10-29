<?php

namespace Raptor\Services\RaptorApi;

use Raptor\Models\User;
use Raptor\Models\Server;
use Raptor\Models\ServerPackage;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Every resource can be addressed the way a billing system knows it: by Panel id, UUID, short
 * identifier, or its own id with the "ext:" prefix (ext:order-1042). Users also by e-mail.
 */
class Lookup
{
    public static function server(string $key): Server
    {
        $query = Server::query()->with(['allocation', 'node', 'user', 'egg', 'package']);

        $server = match (true) {
            str_starts_with($key, 'ext:') => $query->where('external_id', substr($key, 4))->first(),
            ctype_digit($key) => $query->find((int) $key),
            strlen($key) === 8 => $query->where('uuidShort', $key)->first(),
            default => $query->where('uuid', $key)->first(),
        };

        return $server ?? throw new NotFoundHttpException("No server matches \"$key\".");
    }

    public static function user(string $key): User
    {
        $query = User::query();

        $user = match (true) {
            str_starts_with($key, 'ext:') => $query->where('external_id', substr($key, 4))->first(),
            ctype_digit($key) => $query->find((int) $key),
            str_contains($key, '@') => $query->where('email', $key)->first(),
            default => $query->where('uuid', $key)->first(),
        };

        return $user ?? throw new NotFoundHttpException("No user matches \"$key\".");
    }

    public static function package(string|int $key): ServerPackage
    {
        $package = ctype_digit((string) $key)
            ? ServerPackage::query()->find((int) $key)
            : ServerPackage::query()->where('slug', $key)->first();

        return $package ?? throw new NotFoundHttpException("No package matches \"$key\".");
    }
}
