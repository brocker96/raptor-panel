import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function usePersistedState<S = undefined>(
    key: string,
    defaultValue: S
): [S | undefined, Dispatch<SetStateAction<S | undefined>>] {
    const [state, setState] = useState<S | undefined>(() => {
        try {
            const item = localStorage.getItem(key);

            return item === null ? defaultValue : JSON.parse(item);
        } catch (e) {
            console.warn('Failed to retrieve persisted value from store.', e);

            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            // Storage may be full or unavailable (e.g. Safari private mode), persisting is best effort.
            console.warn('Failed to persist value to store.', e);
        }
    }, [key, state]);

    return [state, setState];
}
