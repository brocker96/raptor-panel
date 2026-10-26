import React from 'react';
import { useLocation } from 'react-router-dom';
import { SwitchTransition } from 'react-transition-group';
import Fade from '@/components/elements/Fade';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const StyledSwitchTransition = styled(SwitchTransition)`
    ${tw`relative`};

    & section {
        ${tw`absolute w-full top-0 left-0`};
    }
`;

/**
 * Fades between route changes. The children passed in must render their routes using the
 * location provided by the parent (`<Routes location={location}>`) so that the exiting page
 * continues to render the previous route while the transition is running.
 */
const TransitionRouter = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();

    return (
        <StyledSwitchTransition>
            <Fade timeout={150} key={location.pathname + location.search} in appear unmountOnExit>
                <section>{children}</section>
            </Fade>
        </StyledSwitchTransition>
    );
};

export default TransitionRouter;
