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
    ${tw`px-3 py-3 sm:py-2 flex items-center rounded-md w-full text-sm text-gray-300`};
    transition: 120ms background-color ease, color 120ms ease;

    &:hover {
        ${(props) => (props.danger ? tw`text-rose-300 bg-rose-500/10` : tw`text-white bg-white/5`)};
    }
`;

interface State {
    posX: number;
    /** Bottom and top edge of the toggle that opened the menu, in viewport coordinates. */
    anchorTop: number;
    anchorBottom: number;
    visible: boolean;
    // On small screens the menu is rendered as a bottom sheet instead of a floating menu.
    sheet: boolean;
}

const isSmallScreen = () => window.matchMedia('(max-width: 639px)').matches;

class DropdownMenu extends React.PureComponent<Props, State> {
    menu = createRef<HTMLDivElement>();

    state: State = {
        posX: 0,
        anchorTop: 0,
        anchorBottom: 0,
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
                window.addEventListener('scroll', this.closeOnViewportChange, true);
                window.addEventListener('resize', this.closeOnViewportChange);
            }, 0);

            if (!this.state.sheet) {
                // The menu is rendered in a portal with fixed positioning, so that it is never
                // clipped or offset by the (transformed, overflow hidden) row it was opened from.
                // Keep it inside the viewport and open it upwards when there is no room below.
                const left = Math.round(this.state.posX - menu.offsetWidth);
                menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - menu.offsetWidth - 8))}px`;

                const below = this.state.anchorBottom + 4;
                const fitsBelow = below + menu.offsetHeight <= window.innerHeight - 8;
                menu.style.top = `${fitsBelow ? below : Math.max(8, this.state.anchorTop - menu.offsetHeight - 4)}px`;
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
        window.removeEventListener('scroll', this.closeOnViewportChange, true);
        window.removeEventListener('resize', this.closeOnViewportChange);
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();

        const rect = (e.currentTarget as HTMLElement | null)?.getBoundingClientRect?.();
        // Context menus open at the cursor, buttons below the button that was clicked.
        const fromButton = e.type === 'click' && rect && rect.width > 0;
        this.triggerMenu(fromButton ? rect.right : e.clientX, {
            top: fromButton ? rect.top : e.clientY,
            bottom: fromButton ? rect.bottom : e.clientY,
        });
    };

    // Close the floating menu when the page scrolls or resizes, its fixed position would be stale.
    closeOnViewportChange = () => this.state.visible && !this.state.sheet && this.setState({ visible: false });

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

    triggerMenu = (posX: number, anchor?: { top: number; bottom: number }) =>
        this.setState((s) => ({
            posX: !s.visible ? posX : s.posX,
            anchorTop: !s.visible ? anchor?.top ?? 0 : s.anchorTop,
            anchorBottom: !s.visible ? anchor?.bottom ?? 0 : s.anchorBottom,
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
                                    css={tw`w-full m-2 bg-gray-900 p-2 rounded-xl ring-1 ring-gray-700 shadow-2xl text-gray-300`}
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
                <Portal>
                    <Fade timeout={150} in={this.state.visible} unmountOnExit>
                        <div
                            ref={this.menu}
                            onClick={(e) => {
                                e.stopPropagation();
                                this.setState({ visible: false });
                            }}
                            style={{ width: '12rem', top: -9999, left: -9999 }}
                            css={tw`fixed bg-gray-900 p-1.5 rounded-lg ring-1 ring-gray-700 shadow-2xl text-gray-300 z-50`}
                        >
                            {this.props.children}
                        </div>
                    </Fade>
                </Portal>
            </div>
        );
    }
}

export default DropdownMenu;
