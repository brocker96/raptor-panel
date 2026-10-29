<?php

namespace Raptor\Http\Controllers\Api\Raptor;

use Raptor\Models\User;
use Raptor\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Services\RaptorApi\Lookup;
use Raptor\Services\RaptorApi\Accounts;
use Raptor\Services\RaptorApi\Presenter;
use Raptor\Services\Users\UserUpdateService;
use Raptor\Services\Users\UserDeletionService;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UserController extends RaptorController
{
    public function __construct(private Accounts $accounts)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = User::query()->withCount('servers')->orderByDesc('id');
        foreach (['email', 'external_id', 'username'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->query($field));
            }
        }

        return $this->paginated($query->paginate($this->perPage($request)), fn (User $user) => Presenter::user($user));
    }

    public function show(string $user): JsonResponse
    {
        return new JsonResponse(Presenter::user(Lookup::user($user)));
    }

    /**
     * Create or update: matched by external_id, then e-mail. 201 when created, 200 otherwise.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email|max:191',
            'external_id' => 'nullable|string|max:191',
            'username' => 'nullable|string|min:3|max:191',
            'first_name' => 'nullable|string|max:191',
            'last_name' => 'nullable|string|max:191',
            'password' => 'nullable|string|min:8|max:191',
            'language' => 'nullable|string|max:5',
            'send_welcome_email' => 'boolean',
        ]);

        [$user, $created] = $this->accounts->upsert($data, $request->boolean('send_welcome_email', true));

        return new JsonResponse(Presenter::user($user) + ['created' => $created], $created ? 201 : 200);
    }

    public function update(Request $request, string $user, UserUpdateService $updater): JsonResponse
    {
        $user = Lookup::user($user);
        $data = $request->validate([
            'email' => 'sometimes|email|max:191',
            'external_id' => 'sometimes|nullable|string|max:191',
            'first_name' => 'sometimes|string|max:191',
            'last_name' => 'sometimes|string|max:191',
            'password' => 'sometimes|string|min:8|max:191',
            'language' => 'sometimes|nullable|string|max:5',
        ]);

        $fields = [];
        foreach (['email' => 'email', 'external_id' => 'external_id', 'first_name' => 'name_first', 'last_name' => 'name_last', 'password' => 'password', 'language' => 'language'] as $from => $to) {
            if (array_key_exists($from, $data)) {
                $fields[$to] = $data[$from];
            }
        }
        $updater->handle($user, $fields);

        return new JsonResponse(Presenter::user($user->refresh()));
    }

    public function servers(Request $request, string $user): JsonResponse
    {
        $user = Lookup::user($user);
        $servers = Server::query()->with(['allocation', 'node', 'user', 'egg', 'package'])->where('owner_id', $user->id)->orderBy('id')->get();

        return new JsonResponse(['data' => $servers->map(fn (Server $server) => Presenter::server($server))]);
    }

    /**
     * One click from the shop into the Panel: a link that signs the user in once.
     */
    public function loginLink(Request $request, string $user): JsonResponse
    {
        $redirect = $request->validate(['redirect' => 'nullable|string|max:500'])['redirect'] ?? null;
        $user = Lookup::user($user);

        if ($user->root_admin && !config('raptor.raptor_api.login_links_for_admins')) {
            throw new HttpException(403, 'Sign in links for administrators are turned off (RAPTOR_API_ADMIN_LOGIN_LINKS).');
        }

        return new JsonResponse($this->accounts->loginLink($user, $redirect), 201);
    }

    public function delete(string $user, UserDeletionService $deletion): Response
    {
        $user = Lookup::user($user);
        if ($user->servers()->exists()) {
            throw new HttpException(409, 'This user still owns servers. Delete or transfer them first.');
        }

        $deletion->handle($user);

        return response('', 204);
    }
}
