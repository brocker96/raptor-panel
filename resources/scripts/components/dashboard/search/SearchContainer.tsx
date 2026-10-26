import React, { Suspense, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import useEventListener from '@/plugins/useEventListener';
import { lazyWithPreload } from '@/lib/lazy';
import Tooltip from '@/components/elements/tooltip/Tooltip';

// The search modal is part of the navigation bar on every page, but only downloaded once needed.
const SearchModal = lazyWithPreload(() => import('@/components/dashboard/search/SearchModal'));

export default () => {
    const [visible, setVisible] = useState(false);

    useEventListener('keydown', (e: KeyboardEvent) => {
        if (['input', 'textarea'].indexOf(((e.target as HTMLElement).tagName || 'input').toLowerCase()) < 0) {
            if (!visible && e.metaKey && e.key.toLowerCase() === '/') {
                setVisible(true);
            }
        }
    });

    return (
        <>
            {visible && (
                <Suspense fallback={null}>
                    <SearchModal appear visible={visible} onDismissed={() => setVisible(false)} />
                </Suspense>
            )}
            <Tooltip placement={'bottom'} content={'Search'}>
                <div
                    className={'navigation-link'}
                    onClick={() => setVisible(true)}
                    onMouseEnter={() => SearchModal.preload()}
                    onTouchStart={() => SearchModal.preload()}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </div>
            </Tooltip>
        </>
    );
};
