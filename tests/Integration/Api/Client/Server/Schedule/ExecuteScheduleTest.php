<?php

namespace Raptor\Tests\Integration\Api\Client\Server\Schedule;

use Raptor\Models\Task;
use Raptor\Models\Schedule;
use Illuminate\Http\Response;
use Raptor\Models\Permission;
use Illuminate\Support\Facades\Bus;
use Raptor\Jobs\Schedule\RunTaskJob;
use Raptor\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;

class ExecuteScheduleTest extends ClientApiIntegrationTestCase
{
    /**
     * Test that a schedule can be executed and is updated in the database correctly.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('permissionsDataProvider')]
    public function testScheduleIsExecutedRightAway(array $permissions)
    {
        [$user, $server] = $this->generateTestAccount($permissions);

        Bus::fake();

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create([
            'server_id' => $server->id,
        ]);

        $response = $this->actingAs($user)->postJson($this->link($schedule, '/execute'));
        $response->assertStatus(Response::HTTP_BAD_REQUEST);
        $response->assertJsonPath('errors.0.code', 'DisplayException');
        $response->assertJsonPath('errors.0.detail', 'Cannot process schedule for task execution: no tasks are registered.');

        /** @var Task $task */
        $task = Task::factory()->create([
            'schedule_id' => $schedule->id,
            'sequence_id' => 1,
            'time_offset' => 2,
        ]);

        $this->actingAs($user)->postJson($this->link($schedule, '/execute'))->assertStatus(Response::HTTP_ACCEPTED);

        Bus::assertDispatched(function (RunTaskJob $job) use ($task) {
            // A task executed right now should not have any job delay associated with it.
            $this->assertNull($job->delay);
            $this->assertSame($task->id, $job->task->id);

            return true;
        });
    }

    /**
     * Test that a user without the schedule update permission cannot execute it.
     */
    public function testUserWithoutScheduleUpdatePermissionCannotExecute()
    {
        [$user, $server] = $this->generateTestAccount([Permission::ACTION_SCHEDULE_CREATE]);

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create(['server_id' => $server->id]);

        $this->actingAs($user)->postJson($this->link($schedule, '/execute'))->assertForbidden();
    }

    /**
     * Test that a subuser cannot use a schedule to run tasks they could not run by hand
     * (CVE-2026-86177).
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('taskActionDataProvider')]
    public function testSubuserCannotExecuteScheduleWithoutTaskActionPermission(string $action, string $payload)
    {
        [$user, $server] = $this->generateTestAccount([Permission::ACTION_SCHEDULE_UPDATE]);

        Bus::fake();

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create(['server_id' => $server->id]);

        Task::factory()->create([
            'schedule_id' => $schedule->id,
            'sequence_id' => 1,
            'action' => $action,
            'payload' => $payload,
        ]);

        $this->actingAs($user)->postJson($this->link($schedule, '/execute'))->assertForbidden();

        Bus::assertNotDispatched(RunTaskJob::class);
    }

    /**
     * Test that a subuser holding the permission a task needs can still run the schedule.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('taskActionDataProvider')]
    public function testSubuserWithTaskActionPermissionCanExecuteSchedule(string $action, string $payload)
    {
        [$user, $server] = $this->generateTestAccount([
            Permission::ACTION_SCHEDULE_UPDATE,
            Task::permissionForAction($action, $payload),
        ]);

        Bus::fake();

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create(['server_id' => $server->id]);

        /** @var Task $task */
        $task = Task::factory()->create([
            'schedule_id' => $schedule->id,
            'sequence_id' => 1,
            'action' => $action,
            'payload' => $payload,
        ]);

        $this->actingAs($user)->postJson($this->link($schedule, '/execute'))->assertStatus(Response::HTTP_ACCEPTED);

        Bus::assertDispatched(fn (RunTaskJob $job) => $job->task->id === $task->id);
    }

    /**
     * Test that a task payload predating the current validation rules does not lock the owner
     * out of their own schedule.
     */
    public function testOwnerCanExecuteScheduleWithUnmappableTaskPayload()
    {
        [$user, $server] = $this->generateTestAccount();

        Bus::fake();

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create(['server_id' => $server->id]);

        /** @var Task $task */
        $task = Task::factory()->create([
            'schedule_id' => $schedule->id,
            'sequence_id' => 1,
            'action' => 'power',
            'payload' => 'reboot',
        ]);

        $this->actingAs($user)->postJson($this->link($schedule, '/execute'))->assertStatus(Response::HTTP_ACCEPTED);

        Bus::assertDispatched(fn (RunTaskJob $job) => $job->task->id === $task->id);
    }

    public static function permissionsDataProvider(): array
    {
        // The factory task sends a console command, so a subuser also needs the console.
        return [[[]], [[Permission::ACTION_SCHEDULE_UPDATE, Permission::ACTION_CONTROL_CONSOLE]]];
    }

    public static function taskActionDataProvider(): array
    {
        return [
            ['command', 'say Test'],
            ['power', 'start'],
            ['power', 'stop'],
            ['power', 'restart'],
            ['power', 'kill'],
            ['backup', ''],
        ];
    }
}
