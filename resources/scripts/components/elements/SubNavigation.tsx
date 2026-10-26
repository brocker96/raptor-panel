import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw, { theme } from 'twin.macro';

const Container = styled.div`
    ${tw`w-full bg-neutral-700 shadow overflow-x-auto`};
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
        display: none;
    }

    & > div {
        ${tw`flex items-center text-sm mx-auto px-2`};
        max-width: 1200px;

        & > a,
        & > div {
            ${tw`inline-block py-3 px-4 text-neutral-300 no-underline whitespace-nowrap transition-all duration-150`};

            &:not(:first-of-type) {
                ${tw`sm:ml-2`};
            }

            &:hover {
                ${tw`text-neutral-100`};
            }

            &:active,
            &.active {
                ${tw`text-neutral-100`};
                box-shadow: inset 0 -2px ${theme`colors.cyan.600`.toString()};
            }
        }
    }
`;

/**
 * Horizontally scrollable sub-navigation. On narrow screens not all of the links fit, so the
 * active link is scrolled into view whenever the route changes.
 */
const SubNavigation = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        const container = ref.current;
        const active = container?.querySelector<HTMLElement>('a.active');
        if (!container || !active || container.scrollWidth <= container.clientWidth) {
            return;
        }

        const left = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
        container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }, [pathname]);

    return <Container ref={ref}>{children}</Container>;
};

export default SubNavigation;
