<?php

namespace Raptor\Services\Security;

use Raptor\Models\User;
use Illuminate\Http\Request;
use Psr\Log\LoggerInterface;
use Raptor\Models\UserSession;
use Raptor\Notifications\SecurityAlert;
use Illuminate\Support\Facades\Notification;

/**
 * Sends security alert e-mails. New sign-in alerts can be turned off by the user, alerts about
 * changes to the security of the account are always sent.
 */
class SecurityNotifier
{
    public function __construct(private LoggerInterface $log)
    {
    }

    public function notify(User $user, string $type, ?Request $request = null, ?string $detail = null, ?string $email = null): void
    {
        if (!config('raptor.security.alerts')) {
            return;
        }

        if ($type === SecurityAlert::NEW_SIGN_IN && !$user->security_alerts) {
            return;
        }

        $context = ['detail' => $detail];
        if ($request) {
            $device = UserAgentParser::parse($request->userAgent());
            $context['ip'] = $request->ip();
            $context['device'] = "{$device['browser']}, {$device['os']}";
        }

        try {
            $notification = (new SecurityAlert($user, $type, $context))->locale($user->preferredLocale());
            if ($email) {
                Notification::route('mail', $email)->notify($notification);
            } else {
                $user->notify($notification);
            }
        } catch (\Throwable $exception) {
            $this->log->warning('Could not send a security alert: ' . $exception->getMessage());
        }
    }

    /**
     * A device counts as new when the user never signed in with this browser and system before.
     * The very first sign-in of an account is not reported.
     */
    public function isNewDevice(User $user, Request $request, ?UserSession $except = null): bool
    {
        $current = UserAgentParser::parse($request->userAgent());

        $previous = UserSession::query()
            ->where('user_id', $user->id)
            ->when($except, fn ($query) => $query->where('id', '!=', $except->id))
            ->latest('id')
            ->limit(200)
            ->get(['user_agent', 'ip']);

        if ($previous->isEmpty()) {
            return false;
        }

        return !$previous->contains(function (UserSession $session) use ($current) {
            $device = UserAgentParser::parse($session->user_agent);

            return $device['browser'] === $current['browser'] && $device['os'] === $current['os'];
        });
    }
}
