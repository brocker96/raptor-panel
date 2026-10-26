<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;

class AssetComposer
{
    /**
     * Provide the site configuration to the views so that it can be passed through
     * to the front-end application.
     */
    public function compose(View $view): void
    {
        $view->with('siteConfiguration', [
            'name' => config('app.name') ?? 'Pterodactyl',
            'locale' => config('app.locale') ?? 'en',
            'recaptcha' => [
                'enabled' => config('recaptcha.enabled', false),
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
        ]);
    }
}
