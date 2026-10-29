<?php

namespace Raptor\Http\Middleware\Api\Raptor;

use Raptor\Models\ApiKey;
use Illuminate\Http\Request;
use Raptor\Services\Acl\Api\AdminAcl;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * The Raptor API is for servers talking to servers: it only takes application API keys, and
 * each route names the permission it needs, e.g. "raptor.key:servers,write".
 */
class RequireRaptorKey
{
    public function handle(Request $request, \Closure $next, string $resource = 'servers', string $action = 'read'): mixed
    {
        $token = $request->user()?->currentAccessToken();
        if (!$token instanceof ApiKey || $token->key_type !== ApiKey::TYPE_APPLICATION) {
            throw new AccessDeniedHttpException('The Raptor API needs an application API key, create one in Admin → Raptor API.');
        }

        $permission = $action === 'write' ? AdminAcl::WRITE : AdminAcl::READ;
        foreach (explode('|', $resource) as $name) {
            if (!AdminAcl::check($token, $name, $permission)) {
                throw new AccessDeniedHttpException("This API key needs the \"$action\" permission for \"$name\".");
            }
        }

        return $next($request);
    }
}
