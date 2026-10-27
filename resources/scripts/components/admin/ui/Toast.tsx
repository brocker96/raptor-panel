import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XIcon } from '@heroicons/react/outline';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

type Kind = 'success' | 'error' | 'info';

interface ToastMessage {
    id: number;
    kind: Kind;
    title: string;
    body?: string;
}

let counter = 0;
const listeners = new Set<(toasts: ToastMessage[]) => void>();
let toasts: ToastMessage[] = [];

const emit = () => listeners.forEach((listener) => listener(toasts));

const dismiss = (id: number) => {
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
};

const push = (kind: Kind, title: string, body?: string) => {
    const id = ++counter;
    toasts = [...toasts.slice(-3), { id, kind, title, body }];
    emit();
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
};

export const toast = {
    success: (title: string, body?: string) => push('success', title, body),
    info: (title: string, body?: string) => push('info', title, body),
    error: (title: string, body?: string) => push('error', title, body),
    /** Shows the human readable message of a failed API request. */
    fromError: (error: unknown, title = t('Something went wrong')) => push('error', title, httpErrorToHuman(error)),
};

const icons = { success: CheckCircleIcon, error: ExclamationCircleIcon, info: InformationCircleIcon };

export const Toaster = () => {
    const [items, setItems] = useState<ToastMessage[]>(toasts);

    useEffect(() => {
        listeners.add(setItems);

        return () => {
            listeners.delete(setItems);
        };
    }, []);

    return createPortal(
        <div
            className={
                'fixed z-[70] inset-x-0 bottom-20 sm:bottom-auto sm:top-4 sm:left-auto sm:right-4 flex flex-col items-center sm:items-end gap-2 px-4 pointer-events-none'
            }
            aria-live={'polite'}
        >
            <AnimatePresence initial={false}>
                {items.map((item) => {
                    const Icon = icons[item.kind];

                    return (
                        <motion.div
                            layout
                            key={item.id}
                            initial={{ opacity: 0, y: -16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className={classNames(
                                'pointer-events-auto w-full max-w-sm flex gap-3 rounded-xl p-3.5 bg-gray-900 ring-1 shadow-2xl',
                                {
                                    'ring-raptor-500/30': item.kind === 'success',
                                    'ring-rose-500/30': item.kind === 'error',
                                    'ring-sky-500/30': item.kind === 'info',
                                }
                            )}
                        >
                            <Icon
                                className={classNames('w-5 h-5 flex-shrink-0', {
                                    'text-raptor-400': item.kind === 'success',
                                    'text-rose-400': item.kind === 'error',
                                    'text-sky-400': item.kind === 'info',
                                })}
                            />
                            <div className={'flex-1 min-w-0'}>
                                <p className={'text-sm font-medium text-gray-50'}>{item.title}</p>
                                {item.body && <p className={'mt-0.5 text-xs text-gray-400 break-words'}>{item.body}</p>}
                            </div>
                            <button
                                type={'button'}
                                aria-label={t('Dismiss')}
                                onClick={() => dismiss(item.id)}
                                className={'self-start p-0.5 rounded text-gray-500 hover:text-white'}
                            >
                                <XIcon className={'w-4 h-4'} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>,
        document.body
    );
};
