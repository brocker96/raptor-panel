<?php

namespace Raptor\Http\Controllers\Base;

use Illuminate\Support\Facades\Storage;
use Raptor\Http\Controllers\Controller;
use Raptor\Services\Users\AvatarService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AvatarController extends Controller
{
    /**
     * Serves an uploaded avatar. File names contain a random component and change on every
     * upload, so they can be cached by browsers and Cloudflare for a long time.
     */
    public function __invoke(string $file): Response
    {
        if (!preg_match('/^[a-f0-9-]{36}-[a-z0-9]{10}\.webp$/', $file)) {
            throw new NotFoundHttpException();
        }

        $path = AvatarService::DIRECTORY . '/' . $file;
        if (!Storage::disk('local')->exists($path)) {
            throw new NotFoundHttpException();
        }

        return response(Storage::disk('local')->get($path), 200, [
            'Content-Type' => 'image/webp',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
