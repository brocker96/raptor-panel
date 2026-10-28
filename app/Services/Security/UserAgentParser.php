<?php

namespace Raptor\Services\Security;

/**
 * A deliberately small user agent parser. It only needs to produce a readable label such as
 * "Firefox on Windows" for the session list, not a full device database.
 */
class UserAgentParser
{
    private const BROWSERS = [
        'Edge' => '/Edg(?:e|A|iOS)?\/([\d.]+)/',
        'Opera' => '/(?:OPR|Opera)\/([\d.]+)/',
        'Vivaldi' => '/Vivaldi\/([\d.]+)/',
        'Yandex' => '/YaBrowser\/([\d.]+)/',
        'Samsung Internet' => '/SamsungBrowser\/([\d.]+)/',
        'Firefox' => '/(?:Firefox|FxiOS)\/([\d.]+)/',
        'Chrome' => '/(?:Chrome|CriOS)\/([\d.]+)/',
        'Safari' => '/Version\/([\d.]+).*Safari/',
        'curl' => '/curl\/([\d.]+)/',
    ];

    private const SYSTEMS = [
        'iOS' => '/iPhone|iPad|iPod/',
        'Android' => '/Android/',
        'Windows' => '/Windows/',
        'macOS' => '/Mac OS X|Macintosh/',
        'ChromeOS' => '/CrOS/',
        'Linux' => '/Linux/',
    ];

    /**
     * @return array{browser: string, os: string, type: string}
     */
    public static function parse(?string $agent): array
    {
        $agent = $agent ?? '';

        $browser = 'Unknown browser';
        foreach (self::BROWSERS as $name => $pattern) {
            if (preg_match($pattern, $agent, $matches)) {
                $browser = $name . ' ' . explode('.', $matches[1])[0];
                break;
            }
        }

        $os = 'Unknown system';
        foreach (self::SYSTEMS as $name => $pattern) {
            if (preg_match($pattern, $agent)) {
                $os = $name;
                break;
            }
        }

        $type = match (true) {
            (bool) preg_match('/iPad|Tablet/', $agent) => 'tablet',
            (bool) preg_match('/Mobi|iPhone|Android/', $agent) => 'mobile',
            default => 'desktop',
        };

        return ['browser' => $browser, 'os' => $os, 'type' => $type];
    }
}
