import React, { Suspense, useState } from 'react';
import { SearchIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import useEventListener from '@/plugins/useEventListener';
import { lazyWithPreload } from '@/lib/lazy';
import { t } from '@/i18n';

// The search modal is available on every page, but only downloaded once needed.
const SearchModal = lazyWithPreload(() => import('@/components/dashboard/search/SearchModal'));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
    /** Renders a compact icon only button, used on small screens. */
    compact?: boolean;
    className?: string;
}

export default ({ compact, className }: Props) => {
    const [visible, setVisible] = useState(false);

    // Ctrl/Cmd + K (or "/") opens the server search from anywhere outside of a text field.
    useEventListener('keydown', (e: KeyboardEvent) => {
        if (visible) return;

        const target = e.target as HTMLElement;
        const typing =
            ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) || target.isContentEditable;

        if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (!typing && e.key === '/')) {
            e.preventDefault();
            setVisible(true);
        }
    });

    const preload = () => SearchModal.preload();

    return (
        <>
            {visible && (
                <Suspense fallback={null}>
                    <SearchModal appear visible={visible} onDismissed={() => setVisible(false)} />
                </Suspense>
            )}
            <button
                type={'button'}
                aria-label={t('Search servers')}
                onClick={() => setVisible(true)}
                onMouseEnter={preload}
                onTouchStart={preload}
                className={classNames(
                    compact
                        ? 'flex items-center justify-center w-10 h-10 rounded-md text-gray-300 hover:text-white hover:bg-white/5'
                        : 'group flex items-center gap-2 h-9 w-full max-w-xs pl-3 pr-2 rounded-md text-sm text-gray-400 bg-gray-900 ring-1 ring-inset ring-gray-800 hover:ring-gray-700 hover:text-gray-200 transition',
                    className
                )}
            >
                <SearchIcon className={compact ? 'w-5 h-5' : 'w-4 h-4'} />
                {!compact && (
                    <>
                        <span className={'flex-1 text-left'}>{t('Search servers…')}</span>
                        <kbd
                            className={
                                'hidden sm:inline-flex items-center px-1.5 h-5 rounded text-[0.65rem] font-sans font-medium text-gray-400 bg-gray-800 ring-1 ring-inset ring-gray-700'
                            }
                        >
                            {isMac ? '⌘' : 'Ctrl'} K
                        </kbd>
                    </>
                )}
            </button>
        </>
    );
};
