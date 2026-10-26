import tw from 'twin.macro';
import { createGlobalStyle } from 'styled-components/macro';

export default createGlobalStyle`
    :root {
        color-scheme: dark;
        -webkit-tap-highlight-color: transparent;
    }

    body {
        ${tw`font-sans bg-gray-950 text-gray-200 antialiased`};
        font-feature-settings: 'cv11', 'ss01', 'ss03';
        /* Subtle brand glow behind the page. */
        background-image: radial-gradient(60rem 30rem at 10% -10%, rgb(82 211 33 / 0.07), transparent 60%),
            radial-gradient(50rem 30rem at 110% 0%, rgb(82 211 33 / 0.04), transparent 60%);
        background-attachment: fixed;
    }

    h1, h2, h3, h4, h5, h6 {
        ${tw`font-semibold tracking-tight font-header text-gray-50`};
    }

    p {
        ${tw`text-gray-300 leading-relaxed font-sans`};
    }

    ::selection {
        ${tw`bg-raptor-500/30 text-white`};
    }

    a {
        ${tw`text-raptor-400 hover:text-raptor-300 transition-colors`};
    }

    code {
        ${tw`font-mono`};
    }

    form {
        ${tw`m-0`};
    }

    textarea, select, input, button, button:focus, button:focus-visible {
        ${tw`outline-none`};
    }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0;
    }

    input[type=number] {
        -moz-appearance: textfield !important;
    }

    /* Scroll Bar Style */
    ::-webkit-scrollbar {
        background: none;
        width: 16px;
        height: 16px;
    }

    ::-webkit-scrollbar-thumb {
        border: solid 0 rgb(0 0 0 / 0%);
        border-right-width: 4px;
        border-left-width: 4px;
        -webkit-border-radius: 9px 4px;
        -webkit-box-shadow: inset 0 0 0 1px #4d5550, inset 0 0 0 4px #2c322f;
    }

    ::-webkit-scrollbar-track-piece {
        margin: 4px 0;
    }

    ::-webkit-scrollbar-thumb:horizontal {
        border-right-width: 0;
        border-left-width: 0;
        border-top-width: 4px;
        border-bottom-width: 4px;
        -webkit-border-radius: 4px 9px;
    }

    ::-webkit-scrollbar-corner {
        background: transparent;
    }
`;
