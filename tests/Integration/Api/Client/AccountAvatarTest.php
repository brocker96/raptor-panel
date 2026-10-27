<?php

namespace Raptor\Tests\Integration\Api\Client;

use Raptor\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class AccountAvatarTest extends ClientApiIntegrationTestCase
{
    public function testUploadingAnAvatarStoresACroppedWebpImage(): void
    {
        Storage::fake('local');

        /** @var User $user */
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/api/client/account/avatar', [
            'avatar' => UploadedFile::fake()->image('me.png', 640, 320),
        ])->assertOk();

        $user->refresh();
        $this->assertNotNull($user->avatar);
        $this->assertSame($user->avatar_url, $response->json('avatar_url'));
        Storage::disk('local')->assertExists('avatars/' . $user->avatar);

        $image = imagecreatefromstring(Storage::disk('local')->get('avatars/' . $user->avatar));
        $this->assertSame(256, imagesx($image));
        $this->assertSame(256, imagesy($image));

        // The avatar is served publicly with long lived caching headers.
        $this->get($user->avatar_url)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/webp')
            ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');

        $this->actingAs($user)->getJson('/api/client/account')->assertJsonPath('attributes.avatar_url', $user->avatar_url);
    }

    public function testReplacingAndRemovingAnAvatarDeletesTheOldFile(): void
    {
        Storage::fake('local');

        /** @var User $user */
        $user = User::factory()->create();

        $this->actingAs($user)->post('/api/client/account/avatar', ['avatar' => UploadedFile::fake()->image('a.jpg', 100, 100)])->assertOk();
        $first = $user->refresh()->avatar;

        $this->actingAs($user)->post('/api/client/account/avatar', ['avatar' => UploadedFile::fake()->image('b.jpg', 100, 100)])->assertOk();
        $second = $user->refresh()->avatar;

        $this->assertNotSame($first, $second);
        Storage::disk('local')->assertMissing('avatars/' . $first);

        $this->actingAs($user)->deleteJson('/api/client/account/avatar')->assertOk()->assertJsonPath('avatar_url', null);
        Storage::disk('local')->assertMissing('avatars/' . $second);
        $this->assertNull($user->refresh()->avatar);
    }

    public function testNonImagesAreRejected(): void
    {
        /** @var User $user */
        $user = User::factory()->create();

        $this->actingAs($user)->post('/api/client/account/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('evil.png', '<?php echo "hi";'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->get('/avatars/evil.php')->assertNotFound();
        $this->get('/avatars/' . $user->uuid . '-aaaaaaaaaa.webp')->assertNotFound();
    }
}
