import React from 'react';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';

interface Props {
    isLoading?: boolean;
    size?: 'xsmall' | 'small' | 'large' | 'xlarge';
    color?: 'green' | 'red' | 'primary' | 'grey';
    isSecondary?: boolean;
}

const ButtonStyle = styled.button<Omit<Props, 'isLoading'>>`
    ${tw`relative inline-flex items-center justify-center gap-2 rounded-md font-semibold text-sm transition-all duration-150 select-none`};
    ${tw`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950`};

    ${(props) =>
        ((!props.isSecondary && !props.color) || props.color === 'primary') &&
        !props.isSecondary &&
        css`
            ${tw`bg-raptor-500 text-gray-950 hover:bg-raptor-400 focus-visible:ring-raptor-400`};
            box-shadow: 0 0 0 1px rgb(82 211 33 / 0.4), 0 6px 20px -6px rgb(82 211 33 / 0.55);
        `};

    ${(props) =>
        props.color === 'grey' &&
        !props.isSecondary &&
        tw`bg-gray-700 text-gray-100 ring-1 ring-inset ring-white/5 hover:bg-gray-600 hover:text-white`};

    ${(props) => props.color === 'green' && !props.isSecondary && tw`bg-emerald-600 text-white hover:bg-emerald-500`};

    ${(props) => props.color === 'red' && !props.isSecondary && tw`bg-red-600 text-white hover:bg-red-500`};

    ${(props) => props.size === 'xsmall' && tw`px-2.5 h-7 text-xs`};
    ${(props) => (!props.size || props.size === 'small') && tw`px-4 h-10`};
    ${(props) => props.size === 'large' && tw`px-5 h-12`};
    ${(props) => props.size === 'xlarge' && tw`px-5 h-12 w-full text-base`};

    ${(props) =>
        props.isSecondary &&
        css<Props>`
            ${tw`bg-transparent text-gray-200 ring-1 ring-inset ring-gray-600`};

            &:hover:not(:disabled) {
                ${tw`bg-white/5 text-white ring-gray-500`};
                ${(props) => props.color === 'red' && tw`bg-red-500/10 text-red-300 ring-red-500/50`};
                ${(props) => props.color === 'primary' && tw`bg-raptor-500/10 text-raptor-300 ring-raptor-500/50`};
                ${(props) => props.color === 'green' && tw`bg-emerald-500/10 text-emerald-300 ring-emerald-500/50`};
            }
        `};

    &:active:not(:disabled) {
        transform: scale(0.98);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

type ComponentProps = Omit<JSX.IntrinsicElements['button'], 'ref' | keyof Props> & Props;

const Button: React.FC<React.PropsWithChildren<ComponentProps>> = ({ children, isLoading, ...props }) => (
    <ButtonStyle {...props}>
        {isLoading && (
            <div css={tw`flex absolute justify-center items-center w-full h-full left-0 top-0`}>
                <Spinner size={'small'} />
            </div>
        )}
        <span css={isLoading ? tw`text-transparent` : undefined}>{children}</span>
    </ButtonStyle>
);

type LinkProps = Omit<JSX.IntrinsicElements['a'], 'ref' | keyof Props> & Props;

const LinkButton: React.FC<LinkProps> = (props) => <ButtonStyle as={'a'} {...props} />;

export { LinkButton, ButtonStyle };
export default Button;
