<?php

namespace Raptor\Tests\Integration\Services\Users;

use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\Location;
use Illuminate\Support\Carbon;
use Raptor\Jobs\RevokeSftpAccessJob;
use Illuminate\Support\Facades\Queue;
use Raptor\Services\Users\UserUpdateService;
use Raptor\Tests\Integration\IntegrationTestCase;

class UserSecurityHardeningTest extends IntegrationTestCase
{
    /**
     * Two requests that loaded the user before either used the code must not both pass.
     */
    public function testATotpCodeCanOnlyBeClaimedOnce()
    {
        $user = User::factory()->create(['totp_authenticated_at' => Carbon::now()->subMinute()]);

        $first = User::query()->findOrFail($user->id);
        $second = User::query()->findOrFail($user->id);

        $this->assertTrue($first->claimTotpUse());
        $this->assertFalse($second->claimTotpUse());

        // The winner can claim again later, its model holds the new timestamp.
        Carbon::setTestNow(Carbon::now()->addMinute());
        $this->assertTrue($first->claimTotpUse());
    }

    public function testAFirstTotpUseCanBeClaimed()
    {
        $user = User::factory()->create(['totp_authenticated_at' => null]);

        $this->assertTrue($user->claimTotpUse());
        $this->assertNotNull($user->fresh()->totp_authenticated_at);
    }

    /**
     * A former admin must lose SFTP sessions on servers they could only reach as an admin.
     */
    public function testRemovingAdminRightsEndsSftpSessionsOnEveryNode()
    {
        Queue::fake();
        $location = Location::factory()->create();
        $nodes = Node::factory()->count(2)->create(['location_id' => $location->id]);
        $user = User::factory()->create(['root_admin' => true]);

        $this->app->make(UserUpdateService::class)->handle($user, ['root_admin' => false]);

        foreach ($nodes as $node) {
            Queue::assertPushed(RevokeSftpAccessJob::class, fn ($job) => $job->target->is($node) && $job->user === $user->uuid);
        }
    }

    public function testOtherChangesDoNotEndSftpSessions()
    {
        Queue::fake();
        Node::factory()->create(['location_id' => Location::factory()->create()->id]);
        $user = User::factory()->create(['root_admin' => true]);

        $this->app->make(UserUpdateService::class)->handle($user, ['name_first' => 'Changed']);

        Queue::assertNotPushed(RevokeSftpAccessJob::class);
    }
}
