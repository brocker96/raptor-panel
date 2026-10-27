<?php

namespace Raptor\Traits\Helpers;

trait AvailableLanguages
{
    /**
     * Languages the interface is translated to, with their native names.
     */
    public const LANGUAGES = [
        'en' => 'English',
        'pl' => 'Polski',
        'de' => 'Deutsch',
        'uk' => 'Українська',
        'ru' => 'Русский',
        'be' => 'Беларуская',
        'fr' => 'Français',
        'cs' => 'Čeština',
        'ro' => 'Română',
    ];

    /**
     * Return all the languages available on the Panel, keyed by their ISO 639-1 code. The native
     * name is always used so that people can find their own language in any interface language.
     */
    public function getAvailableLanguages(bool $localize = false): array
    {
        return self::LANGUAGES;
    }
}
