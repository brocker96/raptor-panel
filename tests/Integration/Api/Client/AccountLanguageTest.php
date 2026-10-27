<?php

namespace Raptor\Tests\Integration\Api\Client;

use Raptor\Models\User;
use Raptor\Tests\Integration\IntegrationTestCase;

class AccountLanguageTest extends IntegrationTestCase
{
    public function testUsersCanChooseALanguageOrFollowThePanelDefault(): void
    {
        $user = User::factory()->create();
        $this->assertNull($user->refresh()->language);

        $this->actingAs($user)->putJson('/api/client/account/language', ['language' => 'uk'])->assertNoContent();
        $this->assertSame('uk', $user->refresh()->language);

        $this->actingAs($user)->putJson('/api/client/account/language', ['language' => 'xx'])->assertUnprocessable();
        $this->actingAs($user)->putJson('/api/client/account/language', [])->assertUnprocessable();

        $this->actingAs($user)->putJson('/api/client/account/language', ['language' => null])->assertNoContent();
        $this->assertNull($user->refresh()->language);

        $user->forceDelete();
    }

    public function testInterfaceTranslationsAreServedFromTheLanguageFile(): void
    {
        $this->getJson('/locales/locale.json?locale=ru&namespace=ui')
            ->assertOk()
            ->assertJsonPath('ru.ui.Settings', 'Настройки');

        $this->getJson('/locales/locale.json?locale=en&namespace=ui')->assertOk()->assertJsonPath('en.ui', []);
    }
}
