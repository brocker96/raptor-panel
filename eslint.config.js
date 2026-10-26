import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jestDom from 'eslint-plugin-jest-dom';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['public/**', 'node_modules/**', 'vendor/**', 'resources/views/**', '*.cjs'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['resources/scripts/**/*.{ts,tsx}'],
        plugins: { react, 'react-hooks': reactHooks, prettier },
        languageOptions: {
            globals: { ...globals.browser },
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        settings: {
            react: { version: 'detect' },
            linkComponents: [
                { name: 'Link', linkAttribute: 'to' },
                { name: 'NavLink', linkAttribute: 'to' },
            ],
        },
        rules: {
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            'react-hooks/rules-of-hooks': 'error',
            eqeqeq: 'error',
            'prettier/prettier': ['error', {}, { usePrettierrc: true }],
            // TypeScript can infer this significantly better than eslint ever can.
            'react/prop-types': 0,
            'react/display-name': 0,
            'react/no-unknown-property': ['error', { ignore: ['css'] }],
            '@typescript-eslint/no-explicit-any': 0,
            '@typescript-eslint/no-non-null-assertion': 0,
            '@typescript-eslint/no-empty-object-type': 0,
            '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
        },
    },
    {
        files: ['resources/scripts/**/*.spec.{ts,tsx}'],
        ...jestDom.configs['flat/recommended'],
        languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
    }
);
