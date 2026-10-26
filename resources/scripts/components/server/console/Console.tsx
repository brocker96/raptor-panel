import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalInitOnlyOptions, ITerminalOptions, Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import TerminalWriteBuffer from '@/plugins/TerminalWriteBuffer';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import { usePermissions } from '@/plugins/usePermissions';
import { theme as th } from 'twin.macro';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import classNames from 'classnames';
import { ChevronDoubleRightIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from '@heroicons/react/solid';
import { PaperAirplaneIcon } from '@heroicons/react/outline';

import '@xterm/xterm/css/xterm.css';
import styles from './style.module.css';

const theme = {
    background: th`colors.black`.toString(),
    cursor: 'transparent',
    black: th`colors.black`.toString(),
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: '#396FE2',
    magenta: '#BB80B3',
    cyan: '#2DDAFD',
    white: '#d0d0d0',
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: '#82AAFF',
    brightMagenta: '#C792EA',
    brightCyan: '#89DDFF',
    brightWhite: '#ffffff',
    selectionBackground: '#FAF08955',
};

const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

const terminalProps: ITerminalOptions & ITerminalInitOnlyOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    allowProposedApi: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 30,
    scrollback: 5000,
    theme: theme,
};

const TERMINAL_PRELUDE = '\u001b[1m\u001b[33mcontainer@raptor~ \u001b[0m';

export default () => {
    const ref = useRef<HTMLDivElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const commandInput = useRef<HTMLInputElement>(null);

    // The terminal and its addons must live for the lifetime of the component, creating them on
    // every render would leave the resize handler pointing at an addon that was never loaded.
    const terminal = useMemo(() => new Terminal({ ...terminalProps, fontSize: isSmallScreen() ? 11 : 12 }), []);
    const addons = useMemo(
        () => ({
            fit: new FitAddon(),
            search: new SearchAddon(),
            webLinks: new WebLinksAddon(),
            unicode11: new Unicode11Addon(),
            scrollDownHelper: new ScrollDownHelperAddon(),
        }),
        []
    );

    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Output is batched and written to the terminal at most once per frame.
    const output = useMemo(() => new TerminalWriteBuffer((data) => terminal.write(data)), [terminal]);

    const handleConsoleOutput = (line: string, prelude = false) =>
        output.push((prelude ? TERMINAL_PRELUDE : '') + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');

    const handleTransferStatus = (status: string) => {
        switch (status) {
            // Sent by either the source or target node if a failure occurs.
            case 'failure':
                output.push(TERMINAL_PRELUDE + 'Transfer has failed.\u001b[0m');
                return;
        }
    };

    const handleDaemonErrorOutput = (line: string) =>
        output.push(TERMINAL_PRELUDE + '\u001b[1m\u001b[41m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');

    const handlePowerChangeEvent = (state: string) =>
        output.push(TERMINAL_PRELUDE + 'Server marked as ' + state + '...\u001b[0m');

    const setCommandFromHistory = (index: number) => {
        setHistoryIndex(index);
        if (commandInput.current) {
            commandInput.current.value = history![index] || '';
        }
    };

    const sendCommand = () => {
        const command = commandInput.current?.value || '';
        if (command.length === 0 || !instance) {
            return;
        }

        setHistory((prevHistory) => [command, ...prevHistory!.filter((value) => value !== command)].slice(0, 32));
        setHistoryIndex(-1);

        instance.send('send command', command);
        commandInput.current!.value = '';
    };

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            setCommandFromHistory(Math.min(historyIndex + 1, history!.length - 1));

            // By default up arrow will also bring the cursor to the start of the line,
            // so we'll preventDefault to keep it at the end.
            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            setCommandFromHistory(Math.max(historyIndex - 1, -1));
        }

        if (e.key === 'Enter') {
            sendCommand();
        }
    };

    const find = (direction: 'next' | 'previous', term = searchTerm) => {
        if (!term) {
            addons.search.clearDecorations();
            return;
        }

        const options = {
            decorations: {
                matchOverviewRuler: '#FAF089',
                activeMatchColorOverviewRuler: '#F6E05E',
                matchBackground: '#FAF08944',
                activeMatchBackground: '#F6E05E',
            },
        };

        direction === 'next' ? addons.search.findNext(term, options) : addons.search.findPrevious(term, options);
    };

    const closeSearch = () => {
        setSearchVisible(false);
        addons.search.clearDecorations();
        terminal.clearSelection();
    };

    useEffect(() => {
        if (searchVisible) {
            searchInput.current?.focus();
            searchInput.current?.select();
        }
    }, [searchVisible]);

    useEffect(() => {
        if (!connected || !ref.current || terminal.element) {
            return;
        }

        Object.values(addons).forEach((addon) => terminal.loadAddon(addon));

        terminal.open(ref.current);

        // Activate Unicode 11 for proper emoji and special character width handling
        terminal.unicode.activeVersion = '11';

        addons.fit.fit();

        // The terminal measures the character size of its font once. If the web font finishes
        // loading afterwards the measurement is wrong, so re-apply the font once it is available.
        document.fonts?.load(`${terminal.options.fontSize}px "JetBrains Mono Variable"`).then(() => {
            if (!terminal.element) return;

            const family = terminal.options.fontFamily;
            terminal.options.fontFamily = 'monospace';
            terminal.options.fontFamily = family;
            addons.fit.fit();
        });

        // Add support for capturing keys
        terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
            if (e.type !== 'keydown') {
                return true;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && terminal.hasSelection()) {
                navigator.clipboard?.writeText(terminal.getSelection()).catch(console.error);
                return false;
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setSearchVisible(true);
                return false;
            } else if (e.key === 'Escape') {
                closeSearch();
            }

            return true;
        });
    }, [terminal, connected]);

    // Keep the terminal sized to its container, this also handles orientation changes on
    // mobile devices and layout shifts that would not trigger a window resize event.
    useEffect(() => {
        if (!ref.current || typeof ResizeObserver === 'undefined') {
            return;
        }

        const fit = debounce(() => {
            if (terminal.element) {
                try {
                    addons.fit.fit();
                } catch (error) {
                    // The container can briefly have no dimensions while navigating away.
                }
            }
        }, 50);

        const observer = new ResizeObserver(fit);
        observer.observe(ref.current);

        return () => {
            observer.disconnect();
            fit.clear();
        };
    }, [terminal]);

    useEffect(
        () => () => {
            output.clear();
            terminal.dispose();
        },
        [terminal]
    );

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: handleTransferStatus,
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            // Do not clear the console if the server is being transferred.
            if (!isTransferring) {
                output.clear();
                terminal.clear();
            }

            Object.keys(listeners).forEach((key: string) => {
                instance.addListener(key, listeners[key]);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (instance) {
                Object.keys(listeners).forEach((key: string) => {
                    instance.removeListener(key, listeners[key]);
                });
            }
        };
    }, [connected, instance]);

    return (
        <div className={classNames(styles.terminal, 'relative')}>
            <SpinnerOverlay visible={!connected} size={'large'} />
            <div
                className={classNames(styles.container, styles.overflows_container, { 'rounded-b': !canSendCommands })}
            >
                {searchVisible ? (
                    <div className={styles.search_bar}>
                        <input
                            ref={searchInput}
                            type={'search'}
                            value={searchTerm}
                            placeholder={'Search console...'}
                            aria-label={'Search console output'}
                            enterKeyHint={'search'}
                            autoCapitalize={'none'}
                            autoCorrect={'off'}
                            spellCheck={false}
                            onChange={(e) => {
                                setSearchTerm(e.currentTarget.value);
                                find('next', e.currentTarget.value);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    find(e.shiftKey ? 'previous' : 'next');
                                } else if (e.key === 'Escape') {
                                    closeSearch();
                                }
                            }}
                        />
                        <button type={'button'} aria-label={'Previous match'} onClick={() => find('previous')}>
                            <ChevronUpIcon className={'w-4 h-4'} />
                        </button>
                        <button type={'button'} aria-label={'Next match'} onClick={() => find('next')}>
                            <ChevronDownIcon className={'w-4 h-4'} />
                        </button>
                        <button type={'button'} aria-label={'Close search'} onClick={closeSearch}>
                            <XIcon className={'w-4 h-4'} />
                        </button>
                    </div>
                ) : (
                    connected && (
                        <button
                            type={'button'}
                            className={styles.search_toggle}
                            aria-label={'Search console output'}
                            onClick={() => setSearchVisible(true)}
                        >
                            <SearchIcon className={'w-4 h-4'} />
                        </button>
                    )
                )}
                <div className={'h-full'}>
                    <div id={styles.terminal} ref={ref} />
                </div>
            </div>
            {canSendCommands && (
                <div className={classNames('relative flex', styles.overflows_container)}>
                    <input
                        ref={commandInput}
                        className={classNames('peer', styles.command_input)}
                        type={'text'}
                        placeholder={'Type a command...'}
                        aria-label={'Console command input.'}
                        disabled={!instance || !connected}
                        onKeyDown={handleCommandKeyDown}
                        enterKeyHint={'send'}
                        autoComplete={'off'}
                        autoCorrect={'off'}
                        autoCapitalize={'none'}
                        spellCheck={false}
                    />
                    <div
                        className={classNames(
                            'text-gray-100 peer-focus:text-gray-50 peer-focus:animate-pulse',
                            styles.command_icon
                        )}
                    >
                        <ChevronDoubleRightIcon className={'w-4 h-4'} />
                    </div>
                    {/* Touch devices do not have arrow keys, so expose history and send as buttons. */}
                    <div className={styles.command_actions}>
                        <button
                            type={'button'}
                            aria-label={'Previous command'}
                            disabled={!history?.length}
                            onClick={() => setCommandFromHistory(Math.min(historyIndex + 1, history!.length - 1))}
                        >
                            <ChevronUpIcon className={'w-5 h-5'} />
                        </button>
                        <button
                            type={'button'}
                            aria-label={'Send command'}
                            disabled={!instance || !connected}
                            onClick={sendCommand}
                        >
                            <PaperAirplaneIcon className={'w-5 h-5 rotate-90'} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
