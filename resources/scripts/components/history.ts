import type { NavigateFunction } from 'react-router-dom';

let navigator: NavigateFunction | null = null;

/**
 * Registers the router's navigate function so that code living outside of the React tree
 * (for example the axios interceptors) is able to trigger client side navigation.
 */
export const setNavigator = (fn: NavigateFunction | null) => {
    navigator = fn;
};

export const navigate = (to: string, options?: { replace?: boolean; state?: unknown }) => {
    if (navigator) {
        navigator(to, options);
    } else if (options?.replace) {
        window.location.replace(to);
    } else {
        window.location.assign(to);
    }
};
