const colors = require('tailwindcss/colors');

/*
 * Raptor Panel design tokens.
 *
 * The neutral scale is a slightly green tinted graphite, the accent is the green of the Raptor
 * logo. Existing components refer to "gray"/"neutral" for surfaces and to "blue"/"primary"/"cyan"
 * for accents, so those names are mapped onto the new palette which restyles every screen at once.
 */
const gray = {
    50: '#f4f6f5',
    100: '#e4e8e6',
    200: '#c6cdc9',
    300: '#9da7a1',
    400: '#768079',
    500: '#4d5550',
    600: '#2c322f',
    700: '#1d2220',
    800: '#131715',
    900: '#0c0f0d',
    950: '#080a09',
};

const raptor = {
    50: '#f1fdea',
    100: '#ddfbcd',
    200: '#bcf6a0',
    300: '#92ee69',
    400: '#6fe33f',
    500: '#52d321',
    600: '#3eaf16',
    700: '#308615',
    800: '#296a17',
    900: '#235a18',
    950: '#0e3207',
};

module.exports = {
    content: ['./resources/scripts/**/*.{js,ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
                header: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
            },
            colors: {
                black: '#070908',
                raptor,
                gray,
                neutral: gray,
                // Legacy accent names used across the code base map onto the brand color.
                primary: raptor,
                blue: raptor,
                cyan: raptor,
                green: colors.emerald,
                yellow: colors.amber,
                red: colors.rose,
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            borderRadius: {
                DEFAULT: '0.5rem',
                sm: '0.375rem',
                md: '0.625rem',
                lg: '0.875rem',
                xl: '1.125rem',
            },
            boxShadow: {
                glow: '0 0 0 1px rgb(82 211 33 / 0.25), 0 8px 32px -8px rgb(82 211 33 / 0.35)',
                card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: (theme) => ({
                DEFAULT: theme('colors.gray.700', 'currentColor'),
            }),
            keyframes: {
                'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
                pulse_ring: { '0%': { boxShadow: '0 0 0 0 rgb(82 211 33 / 0.6)' }, '100%': { boxShadow: '0 0 0 6px rgb(82 211 33 / 0)' } },
            },
            animation: {
                'fade-in': 'fade-in 160ms ease-out',
                'pulse-ring': 'pulse_ring 1.6s ease-out infinite',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ],
};
