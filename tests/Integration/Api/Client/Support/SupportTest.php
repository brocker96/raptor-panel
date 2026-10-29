<?php

namespace Raptor\Tests\Integration\Api\Client\Support;

use Raptor\Models\User;
use Raptor\Models\SupportTicket;
use Laravel\Sanctum\TransientToken;
use Illuminate\Support\Facades\Notification;
use Raptor\Notifications\SupportTicketUpdated;
use Raptor\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;

class SupportTest extends ClientApiIntegrationTestCase
{
    public function setUp(): void
    {
        parent::setUp();

        config()->set('raptor.support.enabled', 'true');
    }

    public function testTicketLifecycle()
    {
        Notification::fake();
        [$user, $server] = $this->generateTestAccount();
        $admin = User::factory()->create(['root_admin' => true]);

        $id = $this->actingAs($user)->postJson('/api/client/support/tickets', [
            'subject' => 'Server does not start',
            'category' => 'technical',
            'priority' => 'high',
            'server' => $server->uuid,
            'message' => 'It crashes on boot.',
        ])->assertCreated()->assertJsonPath('status', 'open')->assertJsonPath('server.uuid', $server->uuid)->json('id');

        Notification::assertSentTo($admin, SupportTicketUpdated::class, fn ($n) => $n->forStaff);

        $this->actingAs($admin->withAccessToken(new TransientToken()))->postJson("/api/admin/support/$id/messages", ['message' => 'Looking into it.'])->assertCreated();
        Notification::assertSentTo($user, SupportTicketUpdated::class, fn ($n) => !$n->forStaff);

        $this->actingAs($user)->getJson('/api/client/support/inbox')->assertJsonPath('tickets', 1);
        $this->actingAs($user)->getJson("/api/client/support/tickets/$id")
            ->assertJsonPath('status', 'answered')
            ->assertJsonPath('assignee.uuid', $admin->uuid)
            ->assertJsonCount(2, 'messages')
            ->assertJsonPath('messages.1.staff', true);

        $this->actingAs($user)->postJson("/api/client/support/tickets/$id/close")->assertOk()->assertJsonPath('status', 'closed');
        $this->actingAs($user)->postJson("/api/client/support/tickets/$id/messages", ['message' => 'Back again'])->assertCreated();
        $this->assertSame('open', SupportTicket::query()->find($id)->status);
    }

    public function testUsersOnlySeeTheirOwnTickets()
    {
        [$user] = $this->generateTestAccount();
        $other = User::factory()->create();
        $ticket = SupportTicket::query()->create(['user_id' => $other->id, 'subject' => 'Private']);

        $this->actingAs($user)->getJson("/api/client/support/tickets/{$ticket->id}")->assertNotFound();
        $this->actingAs($user)->postJson("/api/client/support/tickets/{$ticket->id}/messages", ['message' => 'x'])->assertNotFound();
        $this->actingAs($user)->getJson('/api/client/support/tickets')->assertJsonCount(0, 'data');
        $this->actingAs($user)->getJson("/api/admin/support/{$ticket->id}")->assertForbidden();
    }

    public function testTicketsCannotPointAtForeignServersOrBeUrgent()
    {
        [$user] = $this->generateTestAccount();
        [, $foreign] = $this->generateTestAccount();
        $body = ['subject' => 'Help', 'category' => 'general', 'priority' => 'normal', 'message' => 'Hi'];

        $this->actingAs($user)->postJson('/api/client/support/tickets', $body + ['server' => $foreign->uuid])->assertNotFound();
        $this->actingAs($user)->postJson('/api/client/support/tickets', ['priority' => 'urgent'] + $body)->assertUnprocessable();
    }

    /**
     * Settings store "false" as a string, which must still switch the feature off completely.
     */
    public function testSupportCanBeTurnedOff()
    {
        config()->set('raptor.support.enabled', 'false');
        [$user] = $this->generateTestAccount();
        $admin = User::factory()->create(['root_admin' => true]);

        $this->actingAs($user)->getJson('/api/client/support/tickets')->assertNotFound();
        $this->actingAs($user)->getJson('/api/client/support/inbox')->assertNotFound();
        $this->actingAs($admin->withAccessToken(new TransientToken()))->getJson('/api/admin/support')->assertNotFound();
    }
}
