<?php

namespace Raptor\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\JsonResponse;
use Raptor\Services\Users\AvatarService;

class AccountAvatarController extends ClientApiController
{
    public function __construct(private AvatarService $avatarService)
    {
        parent::__construct();
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => 'required|file|max:5120|mimes:jpeg,jpg,png,webp,gif|dimensions:min_width=32,min_height=32,max_width=4096,max_height=4096',
        ]);

        $user = $this->avatarService->store($request->user(), $request->file('avatar'));
        Activity::event('user:account.avatar-changed')->log();

        return new JsonResponse(['avatar_url' => $user->avatar_url]);
    }

    public function delete(Request $request): JsonResponse
    {
        $this->avatarService->delete($request->user());
        Activity::event('user:account.avatar-removed')->log();

        return new JsonResponse(['avatar_url' => null]);
    }
}
