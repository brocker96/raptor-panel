import type { ConfirmMethod } from '@/api/account/security';

/**
 * State shared between the HTTP client and the security dialogs rendered by <SecurityPrompts />.
 * The HTTP client asks for a confirmation or waits for the screen to be unlocked, the dialogs
 * resolve those promises. Kept outside of React so the HTTP client can use it.
 */

export interface ConfirmationRequest {
    methods: ConfirmMethod[];
    strong: boolean;
    resolve: (confirmed: boolean) => void;
}

type Listener = () => void;

const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener());

let confirmation: ConfirmationRequest | null = null;
let pendingConfirmation: Promise<boolean> | null = null;

let locked = false;
let unlockWaiters: (() => void)[] = [];

export const subscribe = (listener: Listener) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export const getConfirmation = () => confirmation;

/**
 * Opens the confirmation dialog and resolves with true once the user confirmed their identity.
 * Parallel requests share one dialog.
 */
export const requestConfirmation = (methods: ConfirmMethod[], strong: boolean): Promise<boolean> => {
    if (pendingConfirmation) return pendingConfirmation;

    pendingConfirmation = new Promise<boolean>((resolve) => {
        confirmation = {
            methods,
            strong,
            resolve: (confirmed) => {
                confirmation = null;
                pendingConfirmation = null;
                emit();
                resolve(confirmed);
            },
        };
        emit();
    });

    return pendingConfirmation;
};

export const isLocked = () => locked;

export const setLocked = (value: boolean, broadcast = true) => {
    if (locked === value) return;

    locked = value;
    if (!value) {
        unlockWaiters.forEach((resolve) => resolve());
        unlockWaiters = [];
    }

    if (broadcast) {
        try {
            localStorage.setItem('raptor:screen-lock', JSON.stringify({ locked: value, at: Date.now() }));
        } catch {
            // Storage may be unavailable (private mode), other tabs then lock on their own.
        }
    }

    emit();
};

/** Resolves once the screen is unlocked, used to replay requests that hit the lock. */
export const waitForUnlock = (): Promise<void> =>
    locked ? new Promise<void>((resolve) => unlockWaiters.push(resolve)) : Promise.resolve();

let lastInteraction = Date.now();

export const markInteraction = () => {
    lastInteraction = Date.now();
};

export const lastInteractionAt = () => lastInteraction;

/**
 * Requests made while the user is not interacting with the page (polling, websocket token
 * refreshes) must not keep the session from locking, the server is told via a header.
 */
export const isBackgroundRequest = () => Date.now() - lastInteraction > 30_000 || document.hidden;
