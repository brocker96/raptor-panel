<?php

namespace Raptor\Notifications;

use Raptor\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * E-mail sent when something security relevant happens on an account, so that the owner notices
 * when it was not them.
 */
class SecurityAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public const NEW_SIGN_IN = 'new-sign-in';
    public const PASSWORD_CHANGED = 'password-changed';
    public const EMAIL_CHANGED = 'email-changed';
    public const TWO_FACTOR_ENABLED = 'two-factor-enabled';
    public const TWO_FACTOR_DISABLED = 'two-factor-disabled';
    public const PASSKEY_ADDED = 'passkey-added';
    public const PIN_CHANGED = 'pin-changed';
    public const ACCOUNT_LOCKED = 'account-locked';
    public const RECOVERY_CODES = 'recovery-codes';

    /**
     * @param array{ip?: string|null, device?: string|null, detail?: string|null} $context
     */
    public function __construct(public User $user, public string $type, public array $context = [])
    {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        [$subject, $line] = match ($this->type) {
            self::NEW_SIGN_IN => [__('New sign-in to your account'), __('Your account was just signed in to from a device that was not used before.')],
            self::PASSWORD_CHANGED => [__('Your password was changed'), __('The password of your account was changed and all other sessions were signed out.')],
            self::EMAIL_CHANGED => [__('Your e-mail address was changed'), __('The e-mail address of your account was changed to :email.', ['email' => $this->context['detail'] ?? ''])],
            self::TWO_FACTOR_ENABLED => [__('Two-step verification enabled'), __('Two-step verification was enabled on your account.')],
            self::TWO_FACTOR_DISABLED => [__('Two-step verification disabled'), __('Two-step verification was disabled on your account. It is now protected by your password only.')],
            self::PASSKEY_ADDED => [__('New passkey added'), __('A passkey named ":name" can now be used to sign in to your account.', ['name' => $this->context['detail'] ?? ''])],
            self::PIN_CHANGED => [__('Your security PIN was changed'), __('The security PIN of your account was set or changed.')],
            self::ACCOUNT_LOCKED => [__('Your account was locked'), __('Your account was locked for :minutes minutes after too many failed sign-in attempts.', ['minutes' => $this->context['detail'] ?? ''])],
            self::RECOVERY_CODES => [__('New recovery codes generated'), __('New two-step recovery codes were generated, the old codes no longer work.')],
            default => [__('Security notice'), __('There was a security relevant change on your account.')],
        };

        $message = (new MailMessage())
            ->subject($subject . ' — ' . config('app.name'))
            ->greeting(__('Hello :name!', ['name' => $this->user->name]))
            ->line($line);

        $details = array_filter([
            __('Time') => now()->toDayDateTimeString() . ' ' . config('app.timezone'),
            __('Device') => $this->context['device'] ?? null,
            __('IP address') => $this->context['ip'] ?? null,
        ]);

        foreach ($details as $label => $value) {
            $message->line("**$label:** $value");
        }

        return $message
            ->line(__('If this was not you, change your password right away and sign out all other sessions on the Security page.'))
            ->action(__('Review account security'), url('/account/security'));
    }
}
