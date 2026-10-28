import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Dialog as HDialog } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from '@heroicons/react/outline';
import { spring } from '@/components/admin/ui/motion';
import { t } from '@/i18n';

export type ModalTone = 'default' | 'danger' | 'warning' | 'success';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    tone?: ModalTone;
    size?: ModalSize;
    /** Buttons rendered in the sticky footer. */
    footer?: React.ReactNode;
    /** Content rendered between the header and the scrolling body, e.g. step indicators or tabs. */
    toolbar?: React.ReactNode;
    /** Prevents closing the modal (escape, backdrop, close button) while an action runs. */
    busy?: boolean;
    /** Removes the padding of the body for lists and tables that run edge to edge. */
    flush?: boolean;
    className?: string;
    /** Element focused when the modal opens, by default the first focusable element. */
    initialFocus?: React.MutableRefObject<HTMLElement | null>;
    children?: React.ReactNode;
}

const sizes: Record<ModalSize, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
};

const tones: Record<ModalTone, string> = {
    default: 'bg-raptor-500/10 text-raptor-400 ring-raptor-500/25',
    success: 'bg-raptor-500/10 text-raptor-400 ring-raptor-500/25',
    danger: 'bg-rose-500/10 text-rose-400 ring-rose-500/25',
    warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
};

const useMobile = () => {
    const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);

    useEffect(() => {
        const query = window.matchMedia('(max-width: 639px)');
        const update = () => setMobile(query.matches);
        query.addEventListener('change', update);

        return () => query.removeEventListener('change', update);
    }, []);

    return mobile;
};

/**
 * The modal used everywhere a user sees a dialog. On desktop it is a centred panel, on phones
 * a sheet sliding in from the bottom with the actions always in reach of the thumb.
 */
const Modal = ({
    open,
    onClose,
    title,
    description,
    icon: Icon,
    tone = 'default',
    size = 'md',
    footer,
    toolbar,
    busy,
    flush,
    className,
    initialFocus,
    children,
}: ModalProps) => {
    const mobile = useMobile();
    const close = () => !busy && onClose();

    return (
        <AnimatePresence>
            {open && (
                <HDialog static open={open} onClose={close} initialFocus={initialFocus} className={'relative z-[60]'}>
                    <motion.div
                        className={'fixed inset-0 bg-black/70 backdrop-blur-[2px]'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        aria-hidden
                    />
                    <div className={'fixed inset-0 overflow-y-auto'}>
                        <div className={'flex min-h-full items-end sm:items-center justify-center sm:p-4'}>
                            <HDialog.Panel
                                as={motion.div}
                                className={classNames(
                                    'relative w-full flex flex-col bg-gray-900 shadow-2xl ring-1 ring-white/10',
                                    'rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh]',
                                    sizes[size],
                                    className
                                )}
                                initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
                                animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                                exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
                                transition={spring}
                            >
                                {mobile && (
                                    <span
                                        aria-hidden
                                        className={'mx-auto mt-2.5 h-1 w-10 flex-shrink-0 rounded-full bg-gray-700'}
                                    />
                                )}
                                {(title || Icon) && (
                                    <header className={'flex items-start gap-3.5 px-5 sm:px-6 pt-4 sm:pt-6'}>
                                        {Icon && (
                                            <span
                                                className={classNames(
                                                    'grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl ring-1 ring-inset',
                                                    tones[tone]
                                                )}
                                            >
                                                <Icon className={'w-5 h-5'} />
                                            </span>
                                        )}
                                        <div className={'min-w-0 flex-1 pt-0.5'}>
                                            {title && (
                                                <HDialog.Title
                                                    className={'text-base font-semibold text-gray-50 break-words pr-6'}
                                                >
                                                    {title}
                                                </HDialog.Title>
                                            )}
                                            {description && (
                                                <HDialog.Description
                                                    as={'div'}
                                                    className={'mt-1 text-sm text-gray-400 leading-relaxed'}
                                                >
                                                    {description}
                                                </HDialog.Description>
                                            )}
                                        </div>
                                    </header>
                                )}
                                <button
                                    type={'button'}
                                    onClick={close}
                                    disabled={busy}
                                    aria-label={t('Close')}
                                    className={
                                        'absolute top-3 right-3 sm:top-4 sm:right-4 grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-100 hover:bg-white/5 disabled:opacity-40 transition-colors'
                                    }
                                >
                                    <XIcon className={'w-4 h-4'} />
                                </button>
                                {toolbar && <div className={'px-5 sm:px-6 pt-4'}>{toolbar}</div>}
                                {children ? (
                                    <div
                                        className={classNames('min-h-0 flex-1 overflow-y-auto overscroll-contain', {
                                            'px-5 sm:px-6 py-5': !flush,
                                            'mt-4': flush && !!(title || toolbar),
                                        })}
                                    >
                                        {children}
                                    </div>
                                ) : (
                                    <div className={'h-5'} />
                                )}
                                {footer && (
                                    <footer
                                        className={
                                            'flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 px-5 sm:px-6 py-3 border-t border-gray-800 bg-gray-950/40 sm:rounded-b-2xl [&>*]:w-full sm:[&>*]:w-auto'
                                        }
                                        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                                    >
                                        {footer}
                                    </footer>
                                )}
                            </HDialog.Panel>
                        </div>
                    </div>
                </HDialog>
            )}
        </AnimatePresence>
    );
};

export default Modal;
