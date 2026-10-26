import { css, CSSObject, FlattenSimpleInterpolation, SimpleInterpolation } from 'styled-components';

const breakpoints = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
};

type Breakpoint = keyof typeof breakpoints;

/**
 * Wraps the provided styles in a min-width media query for the given breakpoint. Mirrors the
 * breakpoints used by Tailwind so that styled-components and utility classes stay in sync.
 */
export const breakpoint =
    (name: Breakpoint) =>
    (strings: TemplateStringsArray | CSSObject, ...interpolations: SimpleInterpolation[]): FlattenSimpleInterpolation =>
        css`
            @media (min-width: ${breakpoints[name]}px) {
                ${css(strings, ...interpolations)};
            }
        `;
