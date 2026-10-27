<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Notifications\MailTested;
use Raptor\Exceptions\DisplayException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Notification;
use Raptor\Providers\SettingsServiceProvider;
use Raptor\Traits\Helpers\AvailableLanguages;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;
use Raptor\Http\Requests\Admin\Settings\BaseSettingsFormRequest;
use Raptor\Http\Requests\Admin\Settings\MailSettingsFormRequest;
use Raptor\Http\Requests\Admin\Settings\AdvancedSettingsFormRequest;

class SettingsController extends AdminApiController
{
    use AvailableLanguages;

    public function __construct(
        private Encrypter $encrypter,
        private Kernel $kernel,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * Returns every setting that can be changed from the admin area along with the options
     * needed to render the settings forms.
     */
    public function index(): JsonResponse
    {
        $recaptchaShipped = config('recaptcha._shipped_secret_key') === config('recaptcha.secret_key')
            || config('recaptcha._shipped_website_key') === config('recaptcha.website_key');

        return new JsonResponse([
            'general' => [
                'app:name' => config('app.name'),
                'app:locale' => config('app.locale'),
                'raptor:auth:2fa_required' => (int) config('raptor.auth.2fa_required'),
            ],
            'mail' => [
                'mail:mailers:smtp:host' => config('mail.mailers.smtp.host'),
                'mail:mailers:smtp:port' => (int) config('mail.mailers.smtp.port'),
                'mail:mailers:smtp:encryption' => config('mail.mailers.smtp.encryption') ?: null,
                'mail:mailers:smtp:username' => config('mail.mailers.smtp.username'),
                'mail:from:address' => config('mail.from.address'),
                'mail:from:name' => config('mail.from.name'),
            ],
            'advanced' => [
                'recaptcha:enabled' => config('recaptcha.enabled') ? 'true' : 'false',
                'recaptcha:website_key' => config('recaptcha.website_key'),
                'recaptcha:secret_key' => config('recaptcha.secret_key'),
                'raptor:guzzle:timeout' => (int) config('raptor.guzzle.timeout'),
                'raptor:guzzle:connect_timeout' => (int) config('raptor.guzzle.connect_timeout'),
                'raptor:client_features:allocations:enabled' => config('raptor.client_features.allocations.enabled') ? 'true' : 'false',
                'raptor:client_features:allocations:range_start' => config('raptor.client_features.allocations.range_start'),
                'raptor:client_features:allocations:range_end' => config('raptor.client_features.allocations.range_end'),
            ],
            'meta' => [
                'languages' => $this->getAvailableLanguages(true),
                'mail_driver' => config('mail.default'),
                'mail_editable' => config('mail.default') === 'smtp',
                'mail_password_set' => !empty(config('mail.mailers.smtp.password')),
                'recaptcha_shipped_keys' => $recaptchaShipped,
            ],
        ]);
    }

    public function updateGeneral(BaseSettingsFormRequest $request): Response
    {
        $this->store($request->normalize());

        return response('', 204);
    }

    public function updateMail(MailSettingsFormRequest $request): Response
    {
        if (config('mail.default') !== 'smtp') {
            throw new DisplayException('Mail settings can only be changed from the Panel when SMTP is the selected mail driver (MAIL_MAILER=smtp).');
        }

        $values = $request->normalize();
        // Sending "!e" explicitly clears a previously stored password.
        if (array_get($values, 'mail:mailers:smtp:password') === '!e') {
            $values['mail:mailers:smtp:password'] = '';
        }

        foreach ($values as $key => $value) {
            if (in_array($key, SettingsServiceProvider::getEncryptedKeys()) && !empty($value)) {
                $values[$key] = $this->encrypter->encrypt($value);
            }
        }

        $this->store($values);

        return response('', 204);
    }

    /**
     * Sends a test email to the currently authenticated administrator.
     */
    public function testMail(Request $request): JsonResponse
    {
        try {
            Notification::route('mail', $request->user()->email)->notify(new MailTested($request->user()));
        } catch (\Throwable $exception) {
            throw new DisplayException('The test email could not be sent: ' . $exception->getMessage(), $exception);
        }

        return new JsonResponse(['email' => $request->user()->email]);
    }

    public function updateAdvanced(AdvancedSettingsFormRequest $request): Response
    {
        $this->store($request->normalize());

        return response('', 204);
    }

    /**
     * Persists the given settings and restarts the queue workers so that they pick up the new
     * configuration values.
     */
    private function store(array $values): void
    {
        foreach ($values as $key => $value) {
            $this->settings->set('settings::' . $key, $value);
        }

        $this->kernel->call('queue:restart');
    }
}
