import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatAlt2Icon } from '@heroicons/react/outline';
import Avatar from '@/components/Avatar';
import { useResource } from '@/api/query';
import { getAdminTickets, Ticket } from '@/api/support';
import { Page, Segmented } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Column, DataTable, Pagination, SearchInput, Toolbar } from '@/components/admin/ui/DataTable';
import { EmptyState } from '@/components/admin/ui/Feedback';
import { ago, useListParams } from '@/components/admin/ui/hooks';
import { categoryLabel, PriorityBadge, StatusBadge } from '@/components/support/meta';
import { t } from '@/i18n';

const Requester = ({ ticket }: { ticket: Ticket }) => (
    <span className={'w-8 h-8 rounded-full overflow-hidden flex-shrink-0'}>
        <Avatar name={ticket.user?.username || '?'} seed={ticket.user?.uuid} src={ticket.user?.avatar_url} />
    </span>
);

const columns: Column<Ticket>[] = [
    {
        key: 'subject',
        header: t('Ticket'),
        cell: (ticket) => (
            <div className={'flex items-center gap-3 min-w-0'}>
                <Requester ticket={ticket} />
                <div className={'min-w-0'}>
                    <p className={'font-medium text-gray-100 truncate'}>
                        <span className={'font-mono text-xs text-gray-500 mr-1.5'}>#{ticket.id}</span>
                        {ticket.subject}
                    </p>
                    <p className={'text-xs text-gray-500 truncate'}>
                        {ticket.user?.username} · {categoryLabel(ticket.category)}
                        {ticket.server && ` · ${ticket.server.name}`}
                    </p>
                </div>
            </div>
        ),
    },
    {
        key: 'status',
        header: t('Status'),
        cell: (ticket) => (
            <div className={'flex gap-1.5'}>
                <StatusBadge status={ticket.status} staff />
                <PriorityBadge priority={ticket.priority} />
            </div>
        ),
    },
    {
        key: 'assignee',
        header: t('Assignee'),
        cell: (ticket) => <span className={'text-gray-400'}>{ticket.assignee?.username || '—'}</span>,
        hideBelow: 'lg',
    },
    {
        key: 'updated',
        header: t('Last message'),
        cell: (ticket) => <span className={'text-gray-500'}>{ago(ticket.last_message_at)}</span>,
        hideBelow: 'md',
    },
];

export default () => {
    const navigate = useNavigate();
    const list = useListParams(['status', 'mine']);
    const { data, isValidating } = useResource(
        ['admin', 'support', list.query],
        (signal) => getAdminTickets(list.query, signal),
        { keepPrevious: true, refetchInterval: 30_000 }
    );

    return (
        <Page
            title={t('Support')}
            icon={ChatAlt2Icon}
            description={t(
                'Tickets from users. Waiting tickets come first, the most urgent and the longest waiting on top.'
            )}
        >
            <Card flush>
                <Toolbar>
                    <SearchInput
                        value={list.search}
                        onChange={list.setSearch}
                        placeholder={t('Search by subject, #number, username or e-mail…')}
                        className={'flex-1'}
                    />
                    <Segmented
                        id={'ticket-status'}
                        value={list.filters.mine ? 'mine' : list.filters.status || 'active'}
                        onChange={(value) => {
                            list.setFilter('mine', value === 'mine' ? '1' : '');
                            list.setFilter('status', value === 'mine' || value === 'active' ? '' : value);
                        }}
                        options={[
                            { value: 'active', label: t('Active') },
                            { value: 'open', label: t('Waiting') },
                            { value: 'mine', label: t('Mine') },
                            { value: 'closed', label: t('Closed') },
                            { value: 'all', label: t('All') },
                        ]}
                    />
                </Toolbar>
                <DataTable
                    rows={data?.data}
                    loading={isValidating}
                    columns={columns}
                    rowKey={(ticket) => ticket.id}
                    onRowClick={(ticket) => navigate(`/admin/support/${ticket.id}`)}
                    mobile={(ticket) => (
                        <div className={'flex items-center gap-3'}>
                            <Requester ticket={ticket} />
                            <div className={'flex-1 min-w-0'}>
                                <p className={'text-sm font-medium text-gray-100 truncate'}>{ticket.subject}</p>
                                <p className={'text-xs text-gray-500 truncate'}>
                                    #{ticket.id} · {ticket.user?.username} · {ago(ticket.last_message_at)}
                                </p>
                            </div>
                            <StatusBadge status={ticket.status} staff />
                        </div>
                    )}
                    empty={
                        <EmptyState
                            icon={ChatAlt2Icon}
                            title={t('No tickets here')}
                            description={t('Nothing is waiting for an answer.')}
                        />
                    }
                />
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
