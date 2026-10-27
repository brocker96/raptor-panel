import Avatar from '@/components/Avatar';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { SelectorIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getUsers } from '@/api/admin';
import { Field } from '@/components/admin/ui/Form';

interface Picked {
    id: number;
    username: string;
    email: string;
}

/** Searchable owner picker that queries users as the admin types. */
export default ({
    label = 'Owner',
    value,
    onChange,
    error,
    description,
}: {
    label?: string;
    value: Picked | null;
    onChange: (user: Picked) => void;
    error?: string;
    description?: string;
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(query), 200);

        return () => clearTimeout(timeout);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !container.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener('mousedown', close);

        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const { data } = useResource(
        ['admin', 'users', 'picker', debounced],
        (signal) => getUsers({ search: debounced || undefined, per_page: 8 }, signal),
        {
            enabled: open,
            keepPrevious: true,
        }
    );

    return (
        <Field label={label} error={error} description={description} required>
            {(id, invalid) => (
                <div ref={container} className={'relative'}>
                    <button
                        id={id}
                        type={'button'}
                        onClick={() => setOpen(!open)}
                        className={classNames(
                            'w-full flex items-center gap-3 h-10 px-3 rounded-lg bg-gray-950/60 ring-1 ring-inset text-left text-sm',
                            invalid ? 'ring-rose-500/70' : 'ring-gray-700 hover:ring-gray-600'
                        )}
                    >
                        <span className={'flex-1 min-w-0 truncate'}>
                            {value ? (
                                <>
                                    <span className={'text-gray-100'}>{value.username}</span>{' '}
                                    <span className={'text-gray-500'}>{value.email}</span>
                                </>
                            ) : (
                                <span className={'text-gray-600'}>Choose a user…</span>
                            )}
                        </span>
                        <SelectorIcon className={'w-4 h-4 text-gray-500'} />
                    </button>
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className={
                                    'absolute z-20 mt-1 w-full rounded-lg bg-gray-900 ring-1 ring-gray-700 shadow-2xl overflow-hidden'
                                }
                            >
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={'Search username or e-mail…'}
                                    className={
                                        'block w-full h-10 px-3 bg-transparent border-0 border-b border-gray-800 text-base sm:text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-0'
                                    }
                                />
                                <ul className={'max-h-64 overflow-y-auto py-1'}>
                                    {data?.data.map((user) => (
                                        <li key={user.id}>
                                            <button
                                                type={'button'}
                                                onClick={() => {
                                                    onChange({
                                                        id: user.id,
                                                        username: user.username,
                                                        email: user.email,
                                                    });
                                                    setOpen(false);
                                                }}
                                                className={classNames(
                                                    'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5',
                                                    value?.id === user.id && 'bg-raptor-500/10'
                                                )}
                                            >
                                                <span className={'w-7 h-7 rounded-full overflow-hidden flex-shrink-0'}>
                                                    <Avatar name={user.username} seed={user.uuid} src={user.avatar} />
                                                </span>
                                                <span className={'min-w-0'}>
                                                    <span className={'block text-sm text-gray-100 truncate'}>
                                                        {user.username}
                                                    </span>
                                                    <span className={'block text-xs text-gray-500 truncate'}>
                                                        {user.email}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                    {data && !data.data.length && (
                                        <li className={'px-3 py-3 text-sm text-gray-500'}>No users found.</li>
                                    )}
                                </ul>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </Field>
    );
};
