import React, { createRef } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Fade from '@/components/elements/Fade';
import Portal from '@/components/elements/Portal';

interface Props {
    children: React.ReactNode;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    ${tw`p-3 sm:p-2 flex items-center rounded w-full text-neutral-500`};
    transition: 150ms all ease;

    &:hover {
        ${(props) => (props.danger ? tw`text-red-700 bg-red-100` : tw`text-neutral-700 bg-neutral-100`)};
    }
`;

interface State {
    posX: number;
    visible: boolean;
    // On small screens the menu is rendered as a bottom sheet instead of a floating menu.
    sheet: boolean;
}

const isSmallScreen = () => window.matchMedia('(max-width: 639px)').matches;

class DropdownMenu extends React.PureComponent<Props, State> {
    menu = createRef<HTMLDivElement>();

    state: State = {
        posX: 0,
        visible: false,
        sheet: false,
    };

    listenerTimeout?: ReturnType<typeof setTimeout>;

    componentWillUnmount() {
        this.removeListeners();
    }

    componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
        const menu = this.menu.current;

        if (this.state.visible && !prevState.visible && menu) {
            // React 18 flushes this update while the opening click (or contextmenu) event is still
            // propagating, so the listeners are registered on the next tick. Otherwise they would
            // receive that same event and immediately close the menu again.
            this.listenerTimeout = setTimeout(() => {
                document.addEventListener('click', this.windowListener);
                document.addEventListener('contextmenu', this.contextMenuListener);
            }, 0);

            if (!this.state.sheet) {
                // Keep the menu within the viewport when it is opened close to the left edge.
                menu.style.left = `${Math.max(8, Math.round(this.state.posX - menu.clientWidth))}px`;
            }
        }

        if (!this.state.visible && prevState.visible) {
            this.removeListeners();
        }
    }

    removeListeners = () => {
        clearTimeout(this.listenerTimeout);
        document.removeEventListener('click', this.windowListener);
        document.removeEventListener('contextmenu', this.contextMenuListener);
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();
        this.triggerMenu(e.clientX);
    };

    contextMenuListener = () => this.setState({ visible: false });

    windowListener = (e: MouseEvent) => {
        const menu = this.menu.current;

        if (e.button === 2 || !this.state.visible || !menu) {
            return;
        }

        if (e.target === menu || menu.contains(e.target as Node)) {
            return;
        }

        if (e.target !== menu && !menu.contains(e.target as Node)) {
            this.setState({ visible: false });
        }
    };

    triggerMenu = (posX: number) =>
        this.setState((s) => ({
            posX: !s.visible ? posX : s.posX,
            visible: !s.visible,
            sheet: !s.visible ? isSmallScreen() : s.sheet,
        }));

    render() {
        if (this.state.sheet) {
            return (
                <div>
                    {this.props.renderToggle(this.onClickHandler)}
                    <Portal>
                        <Fade timeout={150} in={this.state.visible} unmountOnExit>
                            <div css={tw`fixed inset-0 z-50 flex items-end bg-black/60`}>
                                <div
                                    ref={this.menu}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        this.setState({ visible: false });
                                    }}
                                    css={tw`w-full m-2 bg-white p-2 rounded-lg shadow-lg text-neutral-500`}
                                    style={{ marginBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                                >
                                    {this.props.children}
                                </div>
                            </div>
                        </Fade>
                    </Portal>
                </div>
            );
        }

        return (
            <div>
                {this.props.renderToggle(this.onClickHandler)}
                <Fade timeout={150} in={this.state.visible} unmountOnExit>
                    <div
                        ref={this.menu}
                        onClick={(e) => {
                            e.stopPropagation();
                            this.setState({ visible: false });
                        }}
                        style={{ width: '12rem' }}
                        css={tw`absolute bg-white p-2 rounded border border-neutral-700 shadow-lg text-neutral-500 z-50`}
                    >
                        {this.props.children}
                    </div>
                </Fade>
            </div>
        );
    }
}

export default DropdownMenu;
