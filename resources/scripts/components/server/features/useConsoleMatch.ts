import { useEffect, useRef } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';

/**
 * Calls the handler for every console line containing one of the patterns while the server is
 * not running, used to detect problems that a dialog can help to solve.
 */
export default (patterns: (string | RegExp)[], handler: (line: string, match: string) => void) => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        if (!connected || !instance || status === 'running') return undefined;

        const listener = (line: string) => {
            const lower = line.toLowerCase();
            for (const pattern of patterns) {
                if (typeof pattern === 'string') {
                    if (lower.includes(pattern.toLowerCase())) return latest.current(line, pattern);
                } else {
                    const match = pattern.exec(line);
                    if (match) return latest.current(line, match[0]);
                }
            }

            return undefined;
        };

        instance.addListener(SocketEvent.CONSOLE_OUTPUT, listener);

        return () => {
            instance.removeListener(SocketEvent.CONSOLE_OUTPUT, listener);
        };
    }, [connected, instance, status]);
};
