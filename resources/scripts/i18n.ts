import i18n, { TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import I18NextHttpBackend, { HttpBackendOptions } from 'i18next-http-backend';
import I18NextMultiloadBackendAdapter from 'i18next-multiload-backend-adapter';
import { setDefaultLocale } from '@/lib/dateLocale';

// If we're using HMR use a unique hash per page reload so that we're always
// doing cache busting. Otherwise just use the builder provided hash value in
// the URL to allow cache busting to occur whenever the front-end is rebuilt.
const hash = import.meta.hot ? Date.now().toString(16) : import.meta.env.BUILD_HASH;

/** Languages of the interface with their native names, keep in sync with AvailableLanguages.php. */
export const languages: Record<string, string> = {
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
    uk: 'Українська',
    ru: 'Русский',
    be: 'Беларуская',
    fr: 'Français',
    cs: 'Čeština',
    ro: 'Română',
};

/**
 * The language of the interface: the one chosen by the user, otherwise the default language of
 * the Panel.
 */
export const GUEST_LANGUAGE_KEY = 'raptor:language';

export const resolveLanguage = (user?: string | null, panel?: string | null, guest?: boolean): string => {
    if (user && languages[user]) return user;
    if (guest) {
        const chosen = (() => {
            try {
                return localStorage.getItem(GUEST_LANGUAGE_KEY);
            } catch {
                return null;
            }
        })();
        if (chosen && languages[chosen]) return chosen;
    }
    if (panel && languages[panel]) return panel;

    return 'en';
};

/**
 * Loads the translations before the application renders, so that every string (also the ones in
 * module level constants of lazily loaded routes) is translated from the first paint.
 */
export const initI18n = (language: string) => {
    document.documentElement.lang = language;

    const translations = i18n
        .use(I18NextMultiloadBackendAdapter)
        .use(initReactI18next)
        .init({
            debug: false,
            lng: language,
            fallbackLng: 'en',
            ns: ['ui', 'activity'],
            defaultNS: 'ui',
            keySeparator: '.',
            backend: {
                backend: I18NextHttpBackend,
                backendOption: {
                    loadPath: '/locales/locale.json?locale={{lng}}&namespace={{ns}}',
                    queryStringParams: { hash },
                    allowMultiLoading: true,
                } as HttpBackendOptions,
            } as Record<string, any>,
            interpolation: {
                // Per i18n-react documentation: this is not needed since React is already
                // handling escapes for us.
                escapeValue: false,
            },
        })
        .catch((error) => console.error('Failed to load translations', error));

    return Promise.all([translations, setDefaultLocale(language)]);
};

/**
 * Translates an interface string. The English text is the key, so a missing translation shows
 * the English original. Placeholders use the {{name}} syntax.
 */
export const t = (text: string, values?: TOptions): string => {
    const result = i18n.isInitialized
        ? (i18n.t(text, { ...values, ns: 'ui', keySeparator: false, nsSeparator: false, defaultValue: text }) as string)
        : text.replace(/{{\s*(\w+)\s*}}/g, (_, key) => String((values as Record<string, unknown>)?.[key] ?? ''));

    return pseudo ? `⟦${result}⟧` : result;
};

// Marks every translated string, untranslated text then stands out. Enable it in the browser
// console with localStorage.setItem('raptor:i18n-pseudo', '1').
const pseudo = (() => {
    try {
        return localStorage.getItem('raptor:i18n-pseudo') === '1';
    } catch {
        return false;
    }
})();

export default i18n;
