import type { Transition, Variants } from 'framer-motion';

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 };

export const ease: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

/** Page level entrance: fades and slides content up slightly, children animate in a stagger. */
export const page: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { ...ease, staggerChildren: 0.045, delayChildren: 0.04 } },
};

/** Used for the children of a staggered container (cards, table rows, list items). */
export const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: ease },
};

export const fade: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.18 } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
};
