import { RefObject, useEffect, useState } from 'react';

/**
 * Returns true while the referenced element is (close to being) visible in the viewport. Used to
 * avoid polling data for elements the user cannot see.
 */
export default function useInView<T extends Element>(ref: RefObject<T>, rootMargin = '200px'): boolean {
    // Assume elements are hidden until the observer reports otherwise, so that rows far down a list
    // never trigger work on mount. Without IntersectionObserver support everything counts as visible.
    const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
        observer.observe(element);

        return () => observer.disconnect();
    }, [ref, rootMargin]);

    return inView;
}
