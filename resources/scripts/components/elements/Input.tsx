import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export interface Props {
    isLight?: boolean;
    hasError?: boolean;
}

// The panel no longer has light surfaces, "light" inputs use a slightly raised background instead.
const light = css<Props>`
    ${tw`bg-gray-800`};
`;

const checkboxStyle = css<Props>`
    ${tw`bg-gray-900 cursor-pointer appearance-none inline-block align-middle select-none flex-shrink-0 w-4 h-4 text-raptor-500 border border-gray-500 rounded`};
    color-adjust: exact;
    background-origin: border-box;
    transition: all 75ms linear, box-shadow 25ms linear;

    &:checked {
        ${tw`border-transparent bg-no-repeat bg-center`};
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e");
        background-color: currentColor;
        background-size: 100% 100%;
    }

    &:focus {
        ${tw`outline-none border-raptor-400`};
        box-shadow: 0 0 0 3px rgb(82 211 33 / 0.25);
    }
`;

const inputStyle = css<Props>`
    // Reset to normal styling.
    resize: none;
    ${tw`appearance-none outline-none w-full min-w-0`};
    ${tw`px-3 py-2.5 border rounded-md text-sm transition-all duration-150`};
    ${tw`bg-gray-900 border-gray-700 hover:border-gray-600 text-gray-100 placeholder-gray-500 shadow-none focus:ring-0`};

    & + .input-help {
        ${tw`mt-1 text-xs`};
        ${(props) => (props.hasError ? tw`text-red-300` : tw`text-gray-400`)};
    }

    &:required,
    &:invalid {
        ${tw`shadow-none`};
    }

    &:not(:disabled):not(:read-only):focus {
        ${tw`border-raptor-500 ring-[3px] ring-raptor-500/20`};
        ${(props) => props.hasError && tw`border-red-400 ring-red-500/20`};
    }

    &:disabled {
        ${tw`opacity-75`};
    }

    ${(props) => props.isLight && light};
    ${(props) => props.hasError && tw`text-red-100 border-red-500/70 hover:border-red-400`};
`;

const Input = styled.input<Props>`
    &:not([type='checkbox']):not([type='radio']) {
        ${inputStyle};
    }

    &[type='checkbox'],
    &[type='radio'] {
        ${checkboxStyle};

        &[type='radio'] {
            ${tw`rounded-full`};
        }
    }
`;
const Textarea = styled.textarea<Props>`
    ${inputStyle}
`;

export { Textarea };
export default Input;
