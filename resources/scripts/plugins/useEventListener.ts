import { useEffect, useRef } from 'react';

export default (
    eventName: string,
    handler: (e: Event | CustomEvent | UIEvent | any) => void,
    options?: boolean | AddEventListenerOptions
) => {
    const savedHandler = useRef(handler);
    savedHandler.current = handler;

    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    const passive = typeof options === 'object' ? options.passive : undefined;

    useEffect(() => {
        const eventListener = (event: Event) => savedHandler.current(event);

        window.addEventListener(eventName, eventListener, { capture, passive });

        // The capture flag must match the one used when registering the listener, otherwise
        // the browser will not remove it and the handler would leak across mounts.
        return () => window.removeEventListener(eventName, eventListener, { capture });
    }, [eventName, capture, passive]);
};
