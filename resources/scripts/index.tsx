import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/components/App';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// Enable language support.
import './i18n';

createRoot(document.getElementById('app')!).render(<App />);
