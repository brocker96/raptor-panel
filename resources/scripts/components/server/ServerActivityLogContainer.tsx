import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { ClipboardListIcon, XIcon } from '@heroicons/react/outline';
import { useActivityLogs } from '@/api/server/activity';
import { ActivityLogFilters } from '@/api/account/activity';
import useLocationHash from '@/plugins/useLocationHash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import ActivityLogEntry from '@/components/elements/activity/ActivityLogEntry';
import Pager from '@/components/ui/Pager';
import { Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const categories = () => [
    { key: '', label: t('Everything') },
    { key: 'server:console', label: t('Console') },
    { key: 'server:power', label: t('Power') },
    { key: 'server:file', label: t('Files') },
    { key: 'server:sftp', label: 'SFTP' },
    { key: 'server:backup', label: t('Backups') },
    { key: 'server:database', label: t('Databases') },
    { key: 'server:schedule', label: t('Schedules') },
    { key: 'server:subuser', label: t('Users') },
    { key: 'server:allocation', label: t('Network') },
    { key: 'server:startup', label: t('Startup') },
    { key: 'server:settings', label: t('Settings') },
];

export default () => {
    const { hash, pathTo } = useLocationHash();
    const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const { data, isValidating, error } = useActivityLogs(filters, { refetchOnWindowFocus: false });

    useEffect(() => {
        setFilters((value) => ({ ...value, page: 1, filters: { ip: hash.ip, event: hash.event } }));
    }, [hash]);

    const event = filters.filters?.event || '';
    const exact = !!event && !categories().some((c) => c.key === event);

    return (
        <ServerContentBlock
            title={t('Activity')}
            icon={ClipboardListIcon}
            description={t('Everything that happened on this server, and who did it.')}
        >
            <div className={'mb-4 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1'}>
                {categories().map((category) => (
                    <a
                        key={category.key || 'all'}
                        href={`#${category.key ? pathTo({ event: category.key }) : ''}`}
                        className={classNames(
                            'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                            event === category.key
                                ? 'bg-raptor-500/15 text-raptor-200 ring-raptor-500/40'
                                : 'text-gray-400 ring-gray-800 hover:text-gray-100 hover:ring-gray-600'
                        )}
                    >
                        {category.label}
                    </a>
                ))}
            </div>
            {(exact || filters.filters?.ip) && (
                <div className={'mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-400'}>
                    {t('Filtered by')}
                    {exact && <code className={'rounded bg-gray-800 px-1.5 py-0.5 text-gray-200'}>{event}</code>}
                    {filters.filters?.ip && (
                        <code className={'rounded bg-gray-800 px-1.5 py-0.5 text-gray-200'}>{filters.filters.ip}</code>
                    )}
                    <a href={'#'} className={'inline-flex items-center gap-1 text-raptor-400 hover:text-raptor-300'}>
                        <XIcon className={'w-3.5 h-3.5'} />
                        {t('Clear')}
                    </a>
                </div>
            )}
            {error ? (
                <Callout tone={'red'}>{httpErrorToHuman(error)}</Callout>
            ) : !data && isValidating ? (
                <Skeleton className={'h-72 rounded-xl'} />
            ) : !data?.items.length ? (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={ClipboardListIcon}
                        title={t('Nothing here yet')}
                        description={
                            event
                                ? t('No activity matches this filter.')
                                : t('Actions on this server, by you or other users, appear here.')
                        }
                    />
                </div>
            ) : (
                <>
                    <div
                        className={classNames(
                            'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 overflow-hidden transition-opacity',
                            isValidating && 'opacity-70'
                        )}
                    >
                        {data.items.map((activity) => (
                            <ActivityLogEntry key={activity.id} activity={activity}>
                                <span />
                            </ActivityLogEntry>
                        ))}
                    </div>
                    <Pager
                        page={data.pagination.currentPage}
                        total={data.pagination.totalPages}
                        onChange={(page) => setFilters((value) => ({ ...value, page }))}
                    />
                </>
            )}
        </ServerContentBlock>
    );
};
