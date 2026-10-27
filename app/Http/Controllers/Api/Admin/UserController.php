<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\User;
use Raptor\Models\Server;
use Illuminate\Http\Request;
use Raptor\Facades\Activity;
use Illuminate\Http\Response;
use Raptor\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Raptor\Exceptions\DisplayException;
use Illuminate\Database\Eloquent\Builder;
use Raptor\Services\Users\UserUpdateService;
use Raptor\Services\Users\UserCreationService;
use Raptor\Services\Users\UserDeletionService;
use Raptor\Http\Requests\Admin\UserFormRequest;
use Raptor\Http\Requests\Admin\NewUserFormRequest;

class UserController extends AdminApiController
{
    public function __construct(
        private UserCreationService $creationService,
        private UserDeletionService $deletionService,
        private UserUpdateService $updateService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = User::query()->withCount(['servers']);

        if ($search = trim((string) $request->query('search'))) {
            $like = $this->like($search);
            $query->where(fn (Builder $builder) => $builder
                ->where('username', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->orWhere('uuid', 'like', $like)
                ->orWhere('external_id', 'like', $like)
                ->orWhereRaw('CONCAT(name_first, \' \', name_last) LIKE ?', [$like]));
        }

        match ($request->query('filter')) {
            'admins' => $query->where('root_admin', true),
            '2fa' => $query->where('use_totp', true),
            'no-2fa' => $query->where('use_totp', false),
            default => null,
        };

        $sort = $request->query('sort', 'id');
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        $query->orderBy(in_array($column, ['id', 'username', 'email', 'created_at']) ? $column : 'id', $direction);

        return $this->paginated($query->paginate($this->perPage($request)), fn (User $user) => $this->format($user));
    }

    public function view(User $user): JsonResponse
    {
        $user->loadCount('servers');

        $servers = Server::query()->with('node:id,name')->where('owner_id', $user->id)->orderBy('id')->get()
            ->map(fn (Server $server) => [
                'id' => $server->id,
                'identifier' => $server->uuidShort,
                'name' => $server->name,
                'status' => $server->status,
                'node' => $server->node?->name,
            ]);

        $subuserOf = Server::query()
            ->whereHas('subusers', fn (Builder $query) => $query->where('user_id', $user->id))
            ->get(['id', 'uuidShort', 'name'])
            ->map(fn (Server $server) => ['id' => $server->id, 'identifier' => $server->uuidShort, 'name' => $server->name]);

        return new JsonResponse(array_merge($this->format($user), [
            'name_first' => $user->name_first,
            'name_last' => $user->name_last,
            'language' => $user->language,
            'servers' => $servers,
            'subuser_of' => $subuserOf,
            'last_activity' => ActivityLog::query()->where('actor_type', 'user')->where('actor_id', $user->id)->max('timestamp'),
        ]));
    }

    public function store(NewUserFormRequest $request): JsonResponse
    {
        $user = $this->creationService->handle($request->normalize());

        Activity::event('admin:user.create')->subject($user)->property('email', $user->email)->log();

        return new JsonResponse($this->format($user->loadCount('servers')), 201);
    }

    public function update(UserFormRequest $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id && $request->has('root_admin') && !$request->boolean('root_admin')) {
            throw new DisplayException('You cannot remove administrator permissions from your own account.');
        }

        $user = $this->updateService->handle($user, $request->normalize());

        Activity::event('admin:user.update')->subject($user)->property('email', $user->email)->log();

        return new JsonResponse($this->format($user->loadCount('servers')));
    }

    public function delete(Request $request, User $user): Response
    {
        if ($request->user()->id === $user->id) {
            throw new DisplayException('You cannot delete your own account.');
        }

        $this->deletionService->handle($user);

        Activity::event('admin:user.delete')->property('email', $user->email)->log();

        return response('', 204);
    }

    /**
     * Disables two-factor authentication for a user that lost access to their device.
     */
    public function disableTwoFactor(User $user): Response
    {
        $user->update(['use_totp' => false, 'totp_secret' => null]);
        $user->recoveryTokens()->delete();

        Activity::event('admin:user.2fa-disable')->subject($user)->property('email', $user->email)->log();

        return response('', 204);
    }

    private function format(User $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'external_id' => $user->external_id,
            'username' => $user->username,
            'email' => $user->email,
            'name' => trim($user->name_first . ' ' . $user->name_last),
            'root_admin' => $user->root_admin,
            '2fa' => $user->use_totp,
            'avatar' => 'https://www.gravatar.com/avatar/' . md5(strtolower($user->email)) . '?s=160&d=identicon',
            'servers_count' => (int) ($user->servers_count ?? 0),
            'created_at' => $user->created_at?->toAtomString(),
        ];
    }
}
