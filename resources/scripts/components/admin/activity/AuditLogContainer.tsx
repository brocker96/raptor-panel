import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import classNames from 'classnames';
import { format } from 'date-fns';
import { ChevronDownIcon, ClipboardListIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AuditEntry, getActivity } from '@/api/admin';
import { Page, Segmented } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Pagination, SearchInput, Toolbar } from '@/components/admin/ui/DataTable';
import { Badge, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { ago, useListParams } from '@/components/admin/ui/hooks';
import { t } from '@/i18n';

const scopeTone = (event: string) =>
    event.startsWith('admin:')
        ? 'yellow'
        : event.startsWith('auth:')
        ? 'blue'
        : event.startsWith('server:')
        ? 'green'
        : 'gray';

const subjectLink = (type: string, id: number) =>
    ({
        server: `/admin/servers/${id}`,
        user: `/admin/users/${id}`,
        node: `/admin/nodes/${id}`,
        egg: `/admin/nests/eggs/${id}`,
        mount: `/admin/mounts/${id}`,
    }[type]);

const Entry = ({ entry }: { entry: AuditEntry }) => {
    const [open, setOpen] = useState(false);
    const properties = Object.entries(entry.properties || {});

    return (
        <li>
            <button
                type={'button'}
                onClick={() => setOpen(!open)}
                className={'w-full flex items-start gap-3 px-4 sm:px-5 py-3 text-left hover:bg-white/[0.03]'}
            >
                <span className={'flex-1 min-w-0'}>
                    <span className={'flex flex-wrap items-center gap-2'}>
                        <Badge tone={scopeTone(entry.event)}>
                            <span className={'font-mono'}>{entry.event}</span>
                        </Badge>
                        {entry.subjects
                            .filter((subject) => subject.type !== 'user' || subject.id !== entry.actor?.id)
                            .map((subject) => (
                                <span key={`${subject.type}${subject.id}`} className={'text-xs text-gray-400'}>
                                    {subject.type}{' '}
                                    <span className={'text-gray-200'}>{subject.label || `#${subject.id}`}</span>
                                </span>
                            ))}
                    </span>
                    <span className={'mt-1 block text-xs text-gray-500'}>
                        {entry.actor?.username ? (
                            <Link
                                to={`/admin/users/${entry.actor.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className={'text-gray-300 hover:text-white'}
                            >
                                {entry.actor.username}
                            </Link>
                        ) : (
                            <span>{entry.actor ? entry.actor.type : t('System')}</span>
                        )}
                        {entry.ip && <span className={'font-mono'}> · {entry.ip}</span>} ·{' '}
                        <span title={entry.timestamp}>{ago(entry.timestamp)}</span>
                    </span>
                </span>
                {properties.length > 0 && (
                    <ChevronDownIcon
                        className={classNames('mt-1 w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')}
                    />
                )}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={'overflow-hidden'}
                    >
                        <div
                            className={
                                'mx-4 sm:mx-5 mb-3 rounded-lg bg-black/40 ring-1 ring-inset ring-gray-800 p-3 text-xs'
                            }
                        >
                            <p className={'mb-2 text-gray-500'}>{format(new Date(entry.timestamp), 'PPpp')}</p>
                            <dl className={'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono'}>
                                {properties.map(([key, value]) => (
                                    <React.Fragment key={key}>
                                        <dt className={'text-gray-500'}>{key}</dt>
                                        <dd className={'text-gray-200 break-all'}>
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                            {entry.subjects.map((subject) => {
                                const link = subjectLink(subject.type, subject.id);

                                return link ? (
                                    <Link
                                        key={`${subject.type}${subject.id}`}
                                        to={link}
                                        className={'mt-2 mr-3 inline-block text-raptor-300 hover:text-raptor-200'}
                                    >
                                        {t('Open {{type}} →', { type: subject.type })}
                                    </Link>
                                ) : null;
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
};

export default () => {
    const list = useListParams(['scope', 'actor', 'server', 'ip']);
    const { data, isValidating } = useResource(
        ['admin', 'activity', list.query],
        (signal) => getActivity(list.query, signal),
        {
            keepPrevious: true,
            refetchInterval: 30_000,
        }
    );

    return (
        <Page
            title={t('Audit log')}
            icon={ClipboardListIcon}
            description={t('Everything that happened on the Panel: logins, server actions and admin changes.')}
            guide={'audit-log'}
        >
            <Card flush>
                <Toolbar>
                    <SearchInput
                        value={list.search}
                        onChange={list.setSearch}
                        placeholder={t('Search events, IPs, users or properties…')}
                        className={'flex-1'}
                    />
                    <Segmented
                        id={'audit-scope'}
                        value={list.filters.scope || 'all'}
                        onChange={(value) => list.setFilter('scope', value === 'all' ? '' : value)}
                        options={[
                            { value: 'all', label: t('All') },
                            { value: 'auth', label: t('Auth') },
                            { value: 'user', label: t('Account') },
                            { value: 'server', label: t('Server') },
                            { value: 'admin', label: t('Admin') },
                        ]}
                    />
                </Toolbar>
                {(list.filters.actor || list.filters.server) && (
                    <div className={'px-5 pb-3 flex gap-2'}>
                        {list.filters.actor && (
                            <button type={'button'} onClick={() => list.setFilter('actor', '')}>
                                <Badge tone={'blue'}>{t('User #{{actor}} ✕', { actor: list.filters.actor })}</Badge>
                            </button>
                        )}
                        {list.filters.server && (
                            <button type={'button'} onClick={() => list.setFilter('server', '')}>
                                <Badge tone={'green'}>
                                    {t('Server #{{server}} ✕', { server: list.filters.server })}
                                </Badge>
                            </button>
                        )}
                    </div>
                )}
                {!data ? (
                    <div className={'p-5 space-y-3'}>
                        {[...Array(8)].map((_, i) => (
                            <Skeleton key={i} className={'h-12'} />
                        ))}
                    </div>
                ) : data.data.length === 0 ? (
                    <EmptyState
                        icon={ClipboardListIcon}
                        title={t('No activity found')}
                        description={t('Nothing matches these filters.')}
                    />
                ) : (
                    <ul
                        className={classNames(
                            'divide-y divide-gray-800 border-t border-gray-800 transition-opacity',
                            isValidating && 'opacity-70'
                        )}
                    >
                        {data.data.map((entry) => (
                            <Entry key={entry.id} entry={entry} />
                        ))}
                    </ul>
                )}
                {data && (
                    <Pagination
                        page={data.meta.current_page}
                        lastPage={data.meta.last_page}
                        total={data.meta.total}
                        onChange={list.setPage}
                    />
                )}
            </Card>
        </Page>
    );
};
