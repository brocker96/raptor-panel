import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardListIcon,
    FingerPrintIcon,
    KeyIcon,
    SearchIcon,
    ServerIcon,
    ShieldCheckIcon,
    UserCircleIcon,
} from '@heroicons/react/outline';
import getServers from '@/api/getServers';
import { Server } from '@/api/server/getServer';
import { useStoreState } from '@/state/hooks';
import { RequiredModalProps } from '@/components/elements/Modal';
import Modal from '@/components/ui/Modal';
import { ip } from '@/lib/formatters';
import { t } from '@/i18n';

interface Item {
    key: string;
    label: string;
    hint?: string;
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    to: string;
}

const pages = (): Item[] => [
    { key: 'p:account', label: t('Account'), icon: UserCircleIcon, to: '/account' },
    { key: 'p:security', label: t('Security'), icon: ShieldCheckIcon, to: '/account/security' },
    { key: 'p:api', label: t('API keys'), icon: KeyIcon, to: '/account/api' },
    { key: 'p:ssh', label: t('SSH keys'), icon: FingerPrintIcon, to: '/account/ssh' },
    { key: 'p:activity', label: t('Activity'), icon: ClipboardListIcon, to: '/account/activity' },
];

export default ({ visible, onDismissed }: RequiredModalProps) => {
    const navigate = useNavigate();
    const isAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const input = useRef<HTMLInputElement | null>(null);
    const [term, setTerm] = useState('');
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(visible);

    useEffect(() => setOpen(visible), [visible]);

    useEffect(() => {
        setLoading(true);
        const timeout = setTimeout(() => {
            getServers({ query: term || undefined, type: isAdmin && term ? 'admin-all' : undefined })
                .then((result) => setServers(result.items.slice(0, 8)))
                .catch(() => setServers([]))
                .then(() => setLoading(false));
        }, 200);

        return () => clearTimeout(timeout);
    }, [term]);

    const items = useMemo<Item[]>(() => {
        const found = servers.map((server) => {
            const allocation = server.allocations.find((a) => a.isDefault);

            return {
                key: server.uuid,
                label: server.name,
                hint: allocation ? `${allocation.alias || ip(allocation.ip)}:${allocation.port}` : server.node,
                icon: ServerIcon,
                to: `/server/${server.id}`,
            };
        });
        const query = term.toLowerCase();

        return [...found, ...pages().filter((page) => !query || page.label.toLowerCase().includes(query))];
    }, [servers, term]);

    useEffect(() => setActive(0), [items.length, term]);

    const close = () => {
        setOpen(false);
        setTimeout(onDismissed, 200);
    };

    const go = (item?: Item) => {
        if (!item) return;
        navigate(item.to);
        close();
    };

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            go(items[active]);
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            flush
            initialFocus={input}
            className={'sm:self-start sm:mt-[12vh]'}
            toolbar={
                <div className={'relative -mt-1 pr-8'}>
                    <SearchIcon
                        className={classNames(
                            'absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5',
                            loading ? 'text-raptor-400 animate-pulse' : 'text-gray-500'
                        )}
                    />
                    <input
                        ref={input}
                        autoFocus
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        onKeyDown={onKey}
                        placeholder={t('Search servers, addresses or pages…')}
                        className={
                            'w-full bg-transparent pl-8 py-2 text-base text-gray-50 placeholder:text-gray-500 focus:outline-none'
                        }
                    />
                </div>
            }
        >
            <ul className={'border-t border-gray-800 py-2'} role={'listbox'}>
                {items.map((item, index) => (
                    <li key={item.key} role={'option'} aria-selected={index === active}>
                        {index === servers.length && servers.length > 0 && (
                            <p className={'px-5 pt-3 pb-1 text-[0.65rem] uppercase tracking-wider text-gray-600'}>
                                {t('Pages')}
                            </p>
                        )}
                        {index === 0 && servers.length > 0 && (
                            <p className={'px-5 pt-1 pb-1 text-[0.65rem] uppercase tracking-wider text-gray-600'}>
                                {t('Servers')}
                            </p>
                        )}
                        <button
                            type={'button'}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(item)}
                            className={classNames(
                                'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors',
                                index === active ? 'bg-raptor-500/10' : 'hover:bg-white/[0.03]'
                            )}
                        >
                            <item.icon
                                className={classNames(
                                    'w-5 h-5 flex-shrink-0',
                                    index === active ? 'text-raptor-400' : 'text-gray-500'
                                )}
                            />
                            <span className={'min-w-0 flex-1 truncate text-sm text-gray-100'}>{item.label}</span>
                            {item.hint && (
                                <span className={'font-mono text-xs text-gray-500 truncate'}>{item.hint}</span>
                            )}
                        </button>
                    </li>
                ))}
                {!items.length && !loading && (
                    <li className={'px-5 py-8 text-center text-sm text-gray-500'}>
                        {t('Nothing found for “{{term}}”', { term })}
                    </li>
                )}
            </ul>
        </Modal>
    );
};
