import setDefaultOptions from 'date-fns/setDefaultOptions';
import type { Locale } from 'date-fns';

const loaders: Record<string, () => Promise<{ default: Locale }>> = {
    pl: () => import('date-fns/locale/pl'),
    de: () => import('date-fns/locale/de'),
    uk: () => import('date-fns/locale/uk'),
    ru: () => import('date-fns/locale/ru'),
    be: () => import('date-fns/locale/be'),
    fr: () => import('date-fns/locale/fr'),
    cs: () => import('date-fns/locale/cs'),
    ro: () => import('date-fns/locale/ro'),
};

/**
 * Makes every date-fns call ("5 minutes ago", month names) use the interface language. Only the
 * locale of the selected language is downloaded.
 */
export const setDefaultLocale = async (language: string): Promise<void> => {
    const load = loaders[language];
    if (!load) return;

    try {
        setDefaultOptions({ locale: (await load()).default });
    } catch (error) {
        console.error('Failed to load the date locale', error);
    }
};
