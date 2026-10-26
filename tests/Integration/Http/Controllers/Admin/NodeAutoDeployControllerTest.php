<?php

namespace Raptor\Tests\Integration\Http\Controllers\Admin;

use Raptor\Models\Node;
use Raptor\Models\User;
use Raptor\Models\ApiKey;
use Raptor\Models\Location;
use Raptor\Services\Acl\Api\AdminAcl;
use Raptor\Tests\Integration\Http\HttpTestCase;

class NodeAutoDeployControllerTest extends HttpTestCase
{
    public function testGeneratedTokenHasNodeWritePermission(): void
    {
        $node = Node::factory()->for(Location::factory())->create();

        $response = $this->actingAs(User::factory()->admin()->create())
            ->postJson(route('admin.nodes.view.configuration.token', ['node' => $node]));

        $response->assertOk();
        $response->assertJsonPath('node', $node->id);

        $key = ApiKey::query()
            ->where('identifier', substr($response->json('token'), 0, ApiKey::IDENTIFIER_LENGTH))
            ->firstOrFail();

        $this->assertSame(AdminAcl::READ | AdminAcl::WRITE, $key->r_nodes);
    }
}
