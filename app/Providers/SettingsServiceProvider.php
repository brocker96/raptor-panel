<?php

namespace Raptor\Providers;

use Psr\Log\LoggerInterface as Log;
use Illuminate\Database\QueryException;
use Illuminate\Support\ServiceProvider;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Contracts\Encryption\DecryptException;
use Raptor\Contracts\Repository\SettingsRepositoryInterface;
use Illuminate\Contracts\Config\Repository as ConfigRepository;

class SettingsServiceProvider extends ServiceProvider
{
    /**
     * An array of configuration keys to override with database values
     * if they exist.
     */
    protected array $keys = [
        'app:name',
        'app:locale',
        'recaptcha:enabled',
        'recaptcha:secret_key',
        'recaptcha:website_key',
        'raptor:guzzle:timeout',
        'raptor:guzzle:connect_timeout',
        'raptor:console:count',
        'raptor:console:frequency',
        'raptor:auth:2fa_required',
        'raptor:support:enabled',
        'raptor:support:mail',
        'raptor:security:session_days',
        'raptor:security:idle_timeout',
        'raptor:security:confirm_window',
        'raptor:security:confirm_admin',
        'raptor:security:lockout_attempts',
        'raptor:security:lockout_minutes',
        'raptor:security:alerts',
        'raptor:security:passkeys',
        'raptor:security:trusted_device_days',
        'raptor:security:admin_allowlist',
        'raptor:security:password_min_length',
        'raptor:security:screen_lock_max',
        'raptor:client_features:allocations:enabled',
        'raptor:client_features:allocations:range_start',
        'raptor:client_features:allocations:range_end',
        'raptor:cloudflare:trust_proxies',
        'raptor:cloudflare:websocket_keepalive',
        'raptor:cloudflare:ranges',
        'raptor:cloudflare:ranges_updated_at',
        'raptor:updates:channel',
        'raptor:updates:auto_check',
    ];

    /**
     * Keys specific to the mail driver that are only grabbed from the database
     * when using the SMTP driver.
     */
    protected array $emailKeys = [
        'mail:mailers:smtp:host',
        'mail:mailers:smtp:port',
        'mail:mailers:smtp:encryption',
        'mail:mailers:smtp:username',
        'mail:mailers:smtp:password',
        'mail:from:address',
        'mail:from:name',
    ];

    /**
     * Mail drivers that can be selected from the admin area.
     */
    public const SWITCHABLE_MAIL_DRIVERS = ['smtp', 'log'];

    /**
     * Keys that are encrypted and should be decrypted when set in the
     * configuration array.
     */
    protected static array $encrypted = [
        'mail:mailers:smtp:password',
    ];

    /**
     * Boot the service provider.
     */
    public function boot(ConfigRepository $config, Encrypter $encrypter, Log $log, SettingsRepositoryInterface $settings): void
    {
        try {
            $values = $settings->all()->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->value];
            })->toArray();
        } catch (QueryException $exception) {
            $log->notice('A query exception was encountered while trying to load settings from the database: ' . $exception->getMessage());

            return;
        }

        // The admin area can switch between SMTP and "log only" delivery, other drivers (mailgun,
        // ses, ...) are configured in the environment file and are never overridden.
        $driver = array_get($values, 'settings::mail:default');
        if (in_array($driver, self::SWITCHABLE_MAIL_DRIVERS, true) && in_array($config->get('mail.default'), self::SWITCHABLE_MAIL_DRIVERS, true)) {
            $config->set('mail.default', $driver);
        }

        // Only set the email driver settings from the database if we
        // are configured using SMTP as the driver.
        if ($config->get('mail.default') === 'smtp') {
            $this->keys = array_merge($this->keys, $this->emailKeys);
        }

        foreach ($this->keys as $key) {
            $value = array_get($values, 'settings::' . $key, $config->get(str_replace(':', '.', $key)));
            if (in_array($key, self::$encrypted)) {
                try {
                    $value = $encrypter->decrypt($value);
                } catch (DecryptException $exception) {
                }
            }

            switch (strtolower($value)) {
                case 'true':
                case '(true)':
                    $value = true;
                    break;
                case 'false':
                case '(false)':
                    $value = false;
                    break;
                case 'empty':
                case '(empty)':
                    $value = '';
                    break;
                case 'null':
                case '(null)':
                    $value = null;
            }

            $config->set(str_replace(':', '.', $key), $value);
        }
    }

    public static function getEncryptedKeys(): array
    {
        return self::$encrypted;
    }
}
