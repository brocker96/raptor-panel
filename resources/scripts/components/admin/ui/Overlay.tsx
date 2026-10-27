import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { ExclamationIcon, XIcon } from '@heroicons/react/outline';
import Button from '@/components/admin/ui/Button';
import { spring } from '@/components/admin/ui/motion';
import { t } from '@/i18n';

/** Closes the overlay with the escape key and stops the page behind it from scrolling. */
const useOverlay = (open: boolean, onClose: () => void) => {
    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
};

interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    footer?: React.ReactNode;
    /** Wider drawer, used for guides and complex forms. */
    wide?: boolean;
    children: React.ReactNode;
}

/**
 * Panel sliding in from the right on desktop and from the bottom on phones. Used for create and
 * edit forms so that the list the admin was looking at stays in place.
 */
export const Drawer = ({ open, onClose, title, description, icon: Icon, footer, wide, children }: DrawerProps) => {
    useOverlay(open, onClose);
    const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);

    useEffect(() => {
        const query = window.matchMedia('(max-width: 639px)');
        const listener = () => setMobile(query.matches);
        query.addEventListener('change', listener);

        return () => query.removeEventListener('change', listener);
    }, []);

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className={'fixed inset-0 z-50'}>
                    <motion.div
                        className={'absolute inset-0 bg-black/60'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.aside
                        role={'dialog'}
                        aria-modal
                        className={classNames(
                            'absolute flex flex-col bg-gray-900 ring-1 ring-gray-800 shadow-2xl',
                            'inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl',
                            'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:h-full sm:rounded-none sm:rounded-l-2xl',
                            wide ? 'sm:w-[44rem]' : 'sm:w-[30rem]'
                        )}
                        initial={mobile ? { y: '100%' } : { x: '100%' }}
                        animate={mobile ? { y: 0 } : { x: 0 }}
                        exit={mobile ? { y: '100%' } : { x: '100%' }}
                        transition={spring}
                    >
                        <header className={'flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-800'}>
                            {Icon && (
                                <span
                                    className={
                                        'grid place-items-center w-9 h-9 rounded-lg bg-raptor-500/10 text-raptor-400 ring-1 ring-inset ring-raptor-500/20'
                                    }
                                >
                                    <Icon className={'w-5 h-5'} />
                                </span>
                            )}
                            <div className={'flex-1 min-w-0'}>
                                <h2 className={'text-base font-semibold text-gray-50'}>{title}</h2>
                                {description && <p className={'mt-0.5 text-xs text-gray-400'}>{description}</p>}
                            </div>
                            <button
                                type={'button'}
                                onClick={onClose}
                                aria-label={t('Close')}
                                className={'p-1.5 -mr-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5'}
                            >
                                <XIcon className={'w-5 h-5'} />
                            </button>
                        </header>
                        <div className={'flex-1 overflow-y-auto overscroll-contain px-5 py-5'}>{children}</div>
                        {footer && (
                            <footer
                                className={
                                    'flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-950/40'
                                }
                                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                            >
                                {footer}
                            </footer>
                        )}
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

interface ConfirmProps {
    open: boolean;
    title: string;
    children: React.ReactNode;
    confirm?: string;
    danger?: boolean;
    loading?: boolean;
    /** Requires typing this text before the action can be confirmed, for irreversible actions. */
    challenge?: string;
    onConfirm: () => void;
    onClose: () => void;
}

export const Confirm = ({
    open,
    title,
    children,
    confirm = t('Confirm'),
    danger = true,
    loading,
    challenge,
    onConfirm,
    onClose,
}: ConfirmProps) => {
    const [typed, setTyped] = useState('');
    useOverlay(open, onClose);

    useEffect(() => setTyped(''), [open]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className={'fixed inset-0 z-[60] grid place-items-center p-4'}>
                    <motion.div
                        className={'absolute inset-0 bg-black/70'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        role={'alertdialog'}
                        aria-modal
                        className={
                            'relative w-full max-w-md rounded-2xl bg-gray-900 ring-1 ring-gray-800 shadow-2xl p-5'
                        }
                        initial={{ opacity: 0, scale: 0.92, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={spring}
                    >
                        <div className={'flex gap-4'}>
                            <span
                                className={classNames(
                                    'grid place-items-center flex-shrink-0 w-10 h-10 rounded-full ring-1 ring-inset',
                                    danger
                                        ? 'bg-rose-500/10 text-rose-400 ring-rose-500/25'
                                        : 'bg-raptor-500/10 text-raptor-400 ring-raptor-500/25'
                                )}
                            >
                                <ExclamationIcon className={'w-5 h-5'} />
                            </span>
                            <div className={'min-w-0'}>
                                <h3 className={'text-base font-semibold text-gray-50'}>{title}</h3>
                                <div className={'mt-1 text-sm text-gray-400 leading-relaxed'}>{children}</div>
                            </div>
                        </div>
                        {challenge && (
                            <div className={'mt-4'}>
                                <p className={'text-xs text-gray-400 mb-1.5'}>
                                    {t('Type')}{' '}
                                    <code className={'px-1 py-0.5 rounded bg-gray-800 text-gray-100'}>{challenge}</code>{' '}
                                    {t('to confirm.')}
                                </p>
                                <input
                                    autoFocus
                                    value={typed}
                                    onChange={(e) => setTyped(e.target.value)}
                                    className={
                                        'block w-full h-10 px-3 rounded-lg bg-gray-950/60 border-0 ring-1 ring-inset ring-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500'
                                    }
                                />
                            </div>
                        )}
                        <div className={'mt-5 flex justify-end gap-2'}>
                            <Button variant={'ghost'} onClick={onClose}>
                                {t('Cancel')}
                            </Button>
                            <Button
                                variant={danger ? 'danger' : 'primary'}
                                loading={loading}
                                disabled={!!challenge && typed !== challenge}
                                onClick={onConfirm}
                            >
                                {confirm}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
