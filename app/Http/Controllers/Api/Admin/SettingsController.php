<?php

namespace Raptor\Http\Controllers\Api\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Raptor\Notifications\MailTested;
use Raptor\Exceptions\DisplayException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Notification;
use Raptor\Http\Middleware\AdminIpAllowlist;
use Raptor\Providers\SettingsServiceProvider;
use Raptor\Traits\Helpers\AvailableLanguages;
use Symfony\Component\HttpFoundation\IpUtils;
use Illuminate\Contracts\Encryption\Encrypter;
use Raptor\Traits\Commands\EnvironmentWriterTrait;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;
use Raptor\Http\Requests\Admin\Settings\BaseSettingsFormRequest;
use Raptor\Http\Requests\Admin\Settings\MailSettingsFormRequest;
use Raptor\Http\Requests\Admin\Settings\AdvancedSettingsFormRequest;

class SettingsController extends AdminApiController
{
    use AvailableLanguages;
    use EnvironmentWriterTrait;

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
                'raptor:support:enabled' => filter_var(config('raptor.support.enabled'), FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false',
                'raptor:support:mail' => filter_var(config('raptor.support.mail'), FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false',
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
            'security' => [
                'raptor:security:session_days' => (int) config('raptor.security.session_days'),
                'raptor:security:idle_timeout' => (int) config('raptor.security.idle_timeout'),
                'raptor:security:confirm_window' => (int) config('raptor.security.confirm_window'),
                'raptor:security:confirm_admin' => config('raptor.security.confirm_admin') ? 'true' : 'false',
                'raptor:security:lockout_attempts' => (int) config('raptor.security.lockout_attempts'),
                'raptor:security:lockout_minutes' => (int) config('raptor.security.lockout_minutes'),
                'raptor:security:alerts' => config('raptor.security.alerts') ? 'true' : 'false',
                'raptor:security:passkeys' => config('raptor.security.passkeys') ? 'true' : 'false',
                'raptor:security:trusted_device_days' => (int) config('raptor.security.trusted_device_days'),
                'raptor:security:admin_allowlist' => (string) config('raptor.security.admin_allowlist'),
                'raptor:security:password_min_length' => (int) config('raptor.security.password_min_length'),
                'raptor:security:screen_lock_max' => (int) config('raptor.security.screen_lock_max'),
            ],
            'meta' => [
                'ip' => request()->ip(),
                'languages' => $this->getAvailableLanguages(true),
                // APP_ENVIRONMENT_ONLY=true ignores everything saved on these pages.
                'environment_only' => (bool) config('raptor.load_environment_only'),
                'mail_driver' => config('mail.default'),
                'mail_editable' => config('mail.default') === 'smtp',
                'mail_switchable' => in_array(config('mail.default'), SettingsServiceProvider::SWITCHABLE_MAIL_DRIVERS, true),
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

    /**
     * Switches between sending e-mails over SMTP and only writing them to the log, which is the
     * default after installation until a mail server has been configured.
     */
    public function updateMailDriver(Request $request): Response
    {
        $data = $request->validate(['driver' => 'required|in:' . implode(',', SettingsServiceProvider::SWITCHABLE_MAIL_DRIVERS)]);

        if (!in_array(config('mail.default'), SettingsServiceProvider::SWITCHABLE_MAIL_DRIVERS, true)) {
            throw new DisplayException('The mail driver is configured in the .env file (MAIL_MAILER) and cannot be changed here.');
        }

        $this->store(['mail:default' => $data['driver']]);

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

    public function updateSecurity(Request $request): Response
    {
        $data = $request->validate([
            'raptor:security:session_days' => 'required|integer|between:1,365',
            'raptor:security:idle_timeout' => 'required|integer|between:0,10080',
            'raptor:security:confirm_window' => 'required|integer|between:1,120',
            'raptor:security:confirm_admin' => 'required|in:true,false',
            'raptor:security:lockout_attempts' => 'required|integer|between:0,100',
            'raptor:security:lockout_minutes' => 'required|integer|between:1,1440',
            'raptor:security:alerts' => 'required|in:true,false',
            'raptor:security:passkeys' => 'required|in:true,false',
            'raptor:security:trusted_device_days' => 'required|integer|between:0,365',
            'raptor:security:admin_allowlist' => 'present|nullable|string|max:2000',
            'raptor:security:password_min_length' => 'required|integer|between:8,128',
            'raptor:security:screen_lock_max' => 'required|integer|between:0,1440',
        ]);

        $ranges = AdminIpAllowlist::ranges((string) ($data['raptor:security:admin_allowlist'] ?? ''));
        foreach ($ranges as $range) {
            [$address, $mask] = explode('/', $range, 2) + [null, null];
            if (!filter_var($address, FILTER_VALIDATE_IP) || (!is_null($mask) && (!ctype_digit($mask) || (int) $mask > (str_contains($address, ':') ? 128 : 32)))) {
                throw new DisplayException(__(':value is not a valid IP address or CIDR range.', ['value' => $range]));
            }
        }

        // Never allow an administrator to lock themselves out of the admin area.
        if (!empty($ranges) && !IpUtils::checkIp((string) $request->ip(), $ranges)) {
            throw new DisplayException(__('Your current IP address (:ip) is not in the allowlist, saving it would lock you out.', ['ip' => $request->ip()]));
        }

        $data['raptor:security:admin_allowlist'] = empty($ranges) ? '(empty)' : implode(', ', $ranges);

        $this->store($data);

        return response('', 204);
    }

    /**
     * Persists the given settings and restarts the queue workers so that they pick up the new
     * configuration values.
     */
    /**
     * Turns off APP_ENVIRONMENT_ONLY so the settings saved in the admin area take effect. Older
     * installers left it on, which silently ignored every change made on these pages.
     */
    public function useDatabaseSettings(): Response
    {
        $cached = app()->configurationIsCached();
        $this->writeToEnvironment(['APP_ENVIRONMENT_ONLY' => 'false']);
        $this->kernel->call($cached ? 'config:cache' : 'config:clear');
        $this->kernel->call('queue:restart');

        return response('', 204);
    }

    private function store(array $values): void
    {
        foreach ($values as $key => $value) {
            $this->settings->set('settings::' . $key, $value);
        }

        $this->kernel->call('queue:restart');
    }
}
