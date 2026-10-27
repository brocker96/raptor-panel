import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AdminServer, getServers, ListParams } from '@/api/admin';
import { Column, DataTable, Pagination } from '@/components/admin/ui/DataTable';
import { EmptyState, ServerStatusBadge } from '@/components/admin/ui/Feedback';
import { formatMb } from '@/components/admin/ui/hooks';

export const serverColumns: Column<AdminServer>[] = [
    {
        key: 'name',
        header: 'Server',
        cell: (server) => (
            <div className={'min-w-0'}>
                <p className={'font-medium text-gray-100 truncate'}>{server.name}</p>
                <p className={'text-xs text-gray-500 font-mono'}>{server.identifier}</p>
            </div>
        ),
    },
    {
        key: 'owner',
        header: 'Owner',
        cell: (server) => <span className={'truncate'}>{server.owner?.username}</span>,
        hideBelow: 'md',
    },
    {
        key: 'address',
        header: 'Address',
        cell: (server) =>
            server.allocation ? (
                <code className={'text-xs text-gray-400'}>
                    {server.allocation.alias || server.allocation.ip}:{server.allocation.port}
                </code>
            ) : (
                '—'
            ),
        hideBelow: 'lg',
    },
    { key: 'node', header: 'Node', cell: (server) => server.node?.name, hideBelow: 'xl' },
    {
        key: 'resources',
        header: 'Resources',
        cell: (server) => (
            <span className={'text-xs text-gray-400 tabular-nums whitespace-nowrap'}>
                {formatMb(server.memory)} · {formatMb(server.disk)} · {server.cpu ? `${server.cpu}%` : '∞'}
            </span>
        ),
        hideBelow: 'lg',
    },
    { key: 'status', header: 'Status', cell: (server) => <ServerStatusBadge status={server.status} /> },
];

export const ServerMobileRow = ({ server }: { server: AdminServer }) => (
    <div className={'flex items-start gap-3'}>
        <div className={'flex-1 min-w-0'}>
            <p className={'text-sm font-medium text-gray-100 truncate'}>{server.name}</p>
            <p className={'text-xs text-gray-500 truncate'}>
                {server.owner?.username} · {server.node?.name}
            </p>
        </div>
        <ServerStatusBadge status={server.status} />
    </div>
);

/** Server list with a fixed filter, used on node and egg pages. */
export default ({ params, page, onPage }: { params: ListParams; page: number; onPage: (page: number) => void }) => {
    const navigate = useNavigate();
    const query = { ...params, page };
    const { data, isValidating } = useResource(['admin', 'servers', query], (signal) => getServers(query, signal), {
        keepPrevious: true,
    });

    return (
        <>
            <DataTable
                rows={data?.data}
                loading={isValidating}
                columns={serverColumns}
                rowKey={(server) => server.id}
                onRowClick={(server) => navigate(`/admin/servers/${server.id}`)}
                mobile={(server) => <ServerMobileRow server={server} />}
                empty={<EmptyState icon={ServerIcon} title={'No servers'} />}
            />
            {data && (
                <Pagination
                    page={data.meta.current_page}
                    lastPage={data.meta.last_page}
                    total={data.meta.total}
                    onChange={onPage}
                />
            )}
        </>
    );
};
