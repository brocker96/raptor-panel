/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import compress from './build/compress';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => ({
    define: {
        // Used by i18n to bust the cache of translation files whenever the front-end is rebuilt.
        'import.meta.env.BUILD_HASH': JSON.stringify(Date.now().toString(16)),
    },
    plugins: [
        compress(),
        laravel({
            input: 'resources/scripts/index.tsx',
            refresh: ['resources/views/**'],
        }),
        react(),
        // twin.macro and styled-components rely on Babel macros, so only the files that
        // actually make use of them are passed through Babel.
        babel({
            include: /resources[\\/]scripts[\\/].*\.tsx?$/,
            plugins: ['babel-plugin-macros', ['babel-plugin-styled-components', { pure: true }]],
        }),
    ],
    resolve: {
        alias: {
            '@': resolve('./resources/scripts'),
            '@definitions': resolve('./resources/scripts/api/definitions'),
            '@feature': resolve('./resources/scripts/components/server/features'),
        },
    },
    css: {
        modules: {
            generateScopedName: mode === 'production' ? '[hash:base64:8]' : '[name]__[local]',
        },
    },
    build: {
        target: 'es2020',
        sourcemap: false,
        assetsInlineLimit: 4096,
        chunkSizeWarningLimit: 1024,
        rolldownOptions: {
            output: {
                // Keep rarely changing, large vendor libraries in their own long-lived chunks so
                // that a panel update does not invalidate everything a browser already has cached.
                codeSplitting: {
                    groups: [
                        {
                            name: 'react',
                            test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
                        },
                        { name: 'xterm', test: /node_modules[\\/]@xterm[\\/]/ },
                        // Only the editor core is grouped, individual languages are loaded on demand.
                        {
                            name: 'codemirror',
                            test: /node_modules[\\/](@codemirror[\\/](view|state|language|commands|search|autocomplete|lint)|@lezer[\\/](common|highlight|lr)|codemirror|style-mod|w3c-keyname|crelt)[\\/]/,
                        },
                        { name: 'charts', test: /node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/ },
                    ],
                },
            },
        },
    },
    server: {
        host: '0.0.0.0',
        cors: true,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./resources/scripts/setup-tests.ts'],
        include: ['resources/scripts/**/*.spec.{ts,tsx}'],
        css: false,
    },
}));
