import React, { memo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import isEqual from 'react-fast-compare';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { queryClient, useResource } from '@/api/query';
import useInView from '@/plugins/useInView';
import StatusDot, { statusLabel } from '@/components/server/StatusDot';
import { t } from '@/i18n';

interface UsageProps {
    label: string;
    value: string;
    limit: string;
    /** Usage between 0 and 1, or null when the resource is unlimited. */
    usage: number | null;
}

const Usage = ({ label, value, limit, usage }: UsageProps) => (
    <div className={'min-w-0'}>
        <p className={'text-[0.7rem] uppercase tracking-wide text-gray-500'}>{label}</p>
        <p className={'mt-0.5 text-sm text-gray-200 tabular-nums truncate'}>
            {value}
            <span className={'text-xs text-gray-600'}> / {limit}</span>
        </p>
        <div className={'mt-1.5 h-1 rounded-full bg-gray-800 overflow-hidden'}>
            <div
                className={classNames('h-full rounded-full transition-[width] duration-700', {
                    'bg-raptor-500': usage === null || usage <= 0.75,
                    'bg-yellow-400': usage !== null && usage > 0.75 && usage <= 0.9,
                    'bg-red-500': usage !== null && usage > 0.9,
                })}
                style={{ width: `${Math.min(100, (usage ?? 0) * 100)}%` }}
            />
        </div>
    </div>
);

const badge = (server: Server, stats: ServerStats | null): string | null => {
    if (server.status === 'suspended' || stats?.isSuspended) return 'Suspended';
    if (server.isNodeUnderMaintenance) return 'Maintenance';
    if (server.isTransferring) return 'Transferring';
    if (server.status === 'installing') return 'Installing';
    if (server.status === 'install_failed') return 'Install failed';
    if (server.status === 'restoring_backup') return 'Restoring backup';

    return null;
};

const ServerRow = ({ server, className }: { server: Server; className?: string }) => {
    const ref = useRef<HTMLAnchorElement>(null);
    const inView = useInView(ref);
    const suspendedByStatus = server.status === 'suspended';

    // Resource usage is refreshed every 30 seconds, but only for cards that are visible on the screen
    // and while the browser tab is in the foreground. There is no need to waste a request on a
    // suspended server, or one whose node is under maintenance.
    const { data, error } = useResource<ServerStats>(
        ['server:resources', server.uuid],
        (signal) => getServerResourceUsage(server.uuid, signal),
        {
            enabled: inView && !suspendedByStatus && !server.isNodeUnderMaintenance,
            staleTime: 25_000,
            refetchInterval: 30_000,
        }
    );
    const stats = data ?? null;

    // Disabling a query does not stop a request that is already in flight, so explicitly cancel it
    // (aborting the HTTP request through its signal) once the card scrolls out of view.
    useEffect(() => {
        if (!inView) {
            queryClient.cancelQueries({ queryKey: ['server:resources', server.uuid] });
        }
    }, [inView, server.uuid]);

    const allocation = server.allocations.find((alloc) => alloc.isDefault);
    const label = badge(server, stats) || (error ? 'Unreachable' : null);
    const limit = (mb: number) => (mb !== 0 ? bytesToString(mbToBytes(mb), 0) : '∞');

    return (
        <Link
            ref={ref}
            to={`/server/${server.id}`}
            className={classNames(
                'group relative flex flex-col rounded-xl bg-gray-900/80 border border-gray-800 p-4 no-underline',
                'shadow-card hover:border-raptor-500/40 hover:bg-gray-900 transition-all duration-150',
                'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-raptor-500',
                className
            )}
        >
            <div className={'flex items-start gap-3'}>
                <div className={'mt-1.5'}>
                    <StatusDot status={label ? null : stats?.status} />
                </div>
                <div className={'flex-1 min-w-0'}>
                    <p className={'font-semibold text-gray-50 truncate group-hover:text-white'} title={server.name}>
                        {server.name}
                    </p>
                    <p className={'text-xs text-gray-500 truncate'}>{server.description || server.node}</p>
                </div>
                <span
                    className={classNames(
                        'flex-shrink-0 inline-flex items-center h-6 px-2 rounded-full text-[0.7rem] font-medium ring-1 ring-inset',
                        label
                            ? 'bg-yellow-500/10 text-yellow-300 ring-yellow-500/30'
                            : stats?.status === 'running'
                            ? 'bg-raptor-500/10 text-raptor-300 ring-raptor-500/30'
                            : 'bg-gray-800 text-gray-400 ring-gray-700'
                    )}
                >
                    {label || (stats ? statusLabel(stats.status) : '…')}
                </span>
            </div>
            <div className={'mt-4 grid grid-cols-3 gap-3'}>
                <Usage
                    label={t('CPU')}
                    value={stats ? `${stats.cpuUsagePercent.toFixed(0)}%` : '—'}
                    limit={server.limits.cpu !== 0 ? `${server.limits.cpu}%` : '∞'}
                    usage={stats && server.limits.cpu ? stats.cpuUsagePercent / server.limits.cpu : null}
                />
                <Usage
                    label={t('RAM')}
                    value={stats ? bytesToString(stats.memoryUsageInBytes, 1) : '—'}
                    limit={limit(server.limits.memory)}
                    usage={
                        stats && server.limits.memory
                            ? stats.memoryUsageInBytes / mbToBytes(server.limits.memory)
                            : null
                    }
                />
                <Usage
                    label={t('Disk')}
                    value={stats ? bytesToString(stats.diskUsageInBytes, 1) : '—'}
                    limit={limit(server.limits.disk)}
                    usage={stats && server.limits.disk ? stats.diskUsageInBytes / mbToBytes(server.limits.disk) : null}
                />
            </div>
            {allocation && (
                <p className={'mt-4 pt-3 border-t border-gray-800 text-xs font-mono text-gray-500 truncate'}>
                    {allocation.alias || ip(allocation.ip)}:{allocation.port}
                </p>
            )}
        </Link>
    );
};

export default memo(ServerRow, isEqual);
