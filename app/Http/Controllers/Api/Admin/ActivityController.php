<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Raptor\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Raptor\Models\ActivityLogSubject;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

class ActivityController extends AdminApiController
{
    /**
     * Returns the activity of the entire Panel: account actions, server actions and the
     * changes administrators made from the admin area.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::query()->with(['actor', 'subjects.subject']);

        if ($event = trim((string) $request->query('event'))) {
            $query->where('event', 'like', str_replace(['%', '_'], ['\\%', '\\_'], $event) . '%');
        }

        if ($scope = $request->query('scope')) {
            $query->where('event', 'like', $scope . ':%');
        }

        if ($ip = trim((string) $request->query('ip'))) {
            $query->where('ip', 'like', $this->like($ip));
        }

        if ($actor = $request->query('actor')) {
            $query->where('actor_type', (new User())->getMorphClass())->where('actor_id', (int) $actor);
        }

        if ($server = $request->query('server')) {
            $query->whereHas('subjects', fn (Builder $builder) => $builder->where('subject_type', 'server')->where('subject_id', (int) $server));
        }

        if ($search = trim((string) $request->query('search'))) {
            $like = $this->like($search);
            $query->where(fn (Builder $builder) => $builder
                ->where('event', 'like', $like)
                ->orWhere('ip', 'like', $like)
                ->orWhere('properties', 'like', $like)
                ->orWhereHasMorph('actor', [User::class], fn (Builder $user) => $user->where('username', 'like', $like)->orWhere('email', 'like', $like)));
        }

        return $this->paginated(
            $query->orderByDesc('timestamp')->orderByDesc('id')->paginate($this->perPage($request, 50)),
            fn (ActivityLog $log) => [
                'id' => $log->id,
                'event' => $log->event,
                'ip' => $log->ip,
                'description' => $log->description,
                'properties' => $log->properties,
                'timestamp' => $log->timestamp->toAtomString(),
                'actor' => $log->actor instanceof User
                    ? ['type' => 'user', 'id' => $log->actor->id, 'username' => $log->actor->username, 'email' => $log->actor->email]
                    : ($log->actor_type ? ['type' => $log->actor_type, 'id' => $log->actor_id] : null),
                'subjects' => $log->subjects->map(fn (ActivityLogSubject $subject) => [
                    'type' => $subject->subject_type,
                    'id' => $subject->subject_id,
                    'label' => $subject->subject?->getAttribute('name') ?? $subject->subject?->getAttribute('username') ?? $subject->subject?->getAttribute('identifier'),
                ])->values(),
            ],
        );
    }

    /**
     * Returns the list of event prefixes that exist, used for the filter dropdown.
     */
    public function events(): JsonResponse
    {
        return new JsonResponse([
            'data' => ActivityLog::query()->distinct()->orderBy('event')->limit(500)->pluck('event'),
            'subject_types' => array_keys(Relation::morphMap()),
        ]);
    }
}
