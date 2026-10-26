import * as React from 'react';
import tw, { TwStyle } from 'twin.macro';
import styled from 'styled-components/macro';

export type FlashMessageType = 'success' | 'info' | 'warning' | 'error';

interface Props {
    title?: string;
    children: string;
    type?: FlashMessageType;
}

const styling = (type?: FlashMessageType): TwStyle | string => {
    switch (type) {
        case 'error':
            return tw`bg-red-500/10 border-red-500/30 text-red-100`;
        case 'info':
            return tw`bg-gray-800 border-gray-700 text-gray-100`;
        case 'success':
            return tw`bg-raptor-500/10 border-raptor-500/30 text-raptor-100`;
        case 'warning':
            return tw`bg-yellow-500/10 border-yellow-500/30 text-yellow-100`;
        default:
            return '';
    }
};

const getBackground = (type?: FlashMessageType): TwStyle | string => {
    switch (type) {
        case 'error':
            return tw`bg-red-500 text-white`;
        case 'info':
            return tw`bg-gray-600 text-white`;
        case 'success':
            return tw`bg-raptor-500 text-gray-950`;
        case 'warning':
            return tw`bg-yellow-500 text-gray-950`;
        default:
            return '';
    }
};

const Container = styled.div<{ $type?: FlashMessageType }>`
    ${tw`px-3 py-2.5 border items-center leading-normal rounded-lg flex w-full text-sm`};
    ${(props) => styling(props.$type)};
`;
Container.displayName = 'MessageBox.Container';

const MessageBox = ({ title, children, type }: Props) => (
    <Container css={tw`lg:inline-flex`} $type={type} role={'alert'}>
        {title && (
            <span
                className={'title'}
                css={[
                    tw`flex rounded-full uppercase px-2 py-1 text-xs font-bold mr-3 leading-none`,
                    getBackground(type),
                ]}
            >
                {title}
            </span>
        )}
        <span css={tw`mr-2 text-left flex-auto`}>{children}</span>
    </Container>
);
MessageBox.displayName = 'MessageBox';

export default MessageBox;
