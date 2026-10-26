import styled from 'styled-components/macro';
import tw from 'twin.macro';

export default styled.div<{ $hoverable?: boolean }>`
    ${tw`flex rounded-lg no-underline text-gray-200 items-center bg-gray-900/80 p-4 border border-gray-800 transition-all duration-150 overflow-hidden`};
    box-shadow: 0 1px 0 0 rgb(255 255 255 / 0.03) inset;

    ${(props) => props.$hoverable !== false && tw`hover:border-gray-600 hover:bg-gray-900`};

    & .icon {
        ${tw`rounded-lg w-12 h-12 flex items-center justify-center bg-gray-800 text-raptor-400 ring-1 ring-inset ring-white/5`};
    }
`;
