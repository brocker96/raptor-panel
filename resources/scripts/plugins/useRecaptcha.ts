import { useEffect, useRef } from 'react';
import type Reaptcha from 'reaptcha';

const LOAD_TIMEOUT = 15_000;

/**
 * Runs the invisible reCAPTCHA challenge of a form. Submitting before the widget finished rendering
 * (a quick click right after the page loaded) used to fail with "This recaptcha instance did not
 * render yet", now the challenge starts as soon as the widget is ready.
 */
export default () => {
    const ref = useRef<Reaptcha>(null);
    const rendered = useRef(false);
    const pending = useRef<((error: Error) => void) | null>(null);
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => () => clearTimeout(timeout.current), []);

    const run = (onError: (error: Error) => void) => {
        ref.current!.execute().catch(onError);
    };

    const execute = (onError: (error: Error) => void) => {
        if (rendered.current) {
            run(onError);
            return;
        }

        pending.current = onError;
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
            if (!pending.current) return;
            pending.current = null;
            onError(new Error('reCAPTCHA could not be loaded. Check that google.com is reachable and try again.'));
        }, LOAD_TIMEOUT);
    };

    const onRender = () => {
        rendered.current = true;

        if (pending.current) {
            const onError = pending.current;
            pending.current = null;
            clearTimeout(timeout.current);
            run(onError);
        }
    };

    return { ref, execute, onRender, reset: () => ref.current?.reset() };
};
