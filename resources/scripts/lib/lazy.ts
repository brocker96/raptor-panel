import { ComponentType, lazy, LazyExoticComponent } from 'react';

export type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
    /** Starts downloading the component's code without rendering it. */
    preload: () => Promise<unknown>;
};

/**
 * Same as React.lazy, but the component can be preloaded ahead of time, for example when the user
 * hovers or touches a link pointing to it, so the next page opens without waiting on the network.
 */
export function lazyWithPreload<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
    let promise: Promise<{ default: T }> | null = null;
    const load = () => {
        if (!promise) {
            promise = factory().catch((error) => {
                // Allow trying again later, e.g. after a network error or a new deployment.
                promise = null;
                throw error;
            });
        }

        return promise;
    };

    return Object.assign(lazy(load), { preload: load });
}

/** Runs the callback once the browser is idle, falling back to a timeout where unsupported. */
export function whenIdle(callback: () => void, timeout = 2000): () => void {
    if (typeof window.requestIdleCallback === 'function') {
        const handle = window.requestIdleCallback(callback, { timeout });

        return () => window.cancelIdleCallback(handle);
    }

    const handle = setTimeout(callback, 200);

    return () => clearTimeout(handle);
}
