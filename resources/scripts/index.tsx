import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { initI18n, resolveLanguage } from './i18n';

const { RaptorUser, SiteConfiguration } = window as unknown as {
    RaptorUser?: { language?: string | null };
    SiteConfiguration?: { locale?: string };
};

// The translations are loaded first and the application afterwards, so that every module (and
// the strings it defines) is evaluated with the right language.
initI18n(resolveLanguage(RaptorUser?.language, SiteConfiguration?.locale, !RaptorUser))
    .then(() => import('@/components/App'))
    .then(({ default: App }) => createRoot(document.getElementById('app')!).render(<App />));
