import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { ArrowDownIcon, ArrowUpIcon, ChipIcon, ClockIcon, DatabaseIcon, ServerIcon } from '@heroicons/react/outline';
import { bytesToString, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import UptimeDuration from '@/components/server/UptimeDuration';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import parseStats from '@/plugins/parseStats';
import styles from './style.module.css';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime' | 'rx' | 'tx', number>;

interface MetricProps {
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    label: string;
    value: React.ReactNode;
    limit?: string | null;
    /** Usage between 0 and 1, renders a progress bar when provided. */
    usage?: number | null;
    offline?: boolean;
    children?: React.ReactNode;
}

const Metric = ({ icon: Icon, label, value, limit, usage, offline, children }: MetricProps) => {
    const level = usage === undefined || usage === null ? null : usage > 0.9 ? 'danger' : usage > 0.75 ? 'warn' : 'ok';

    return (
        <div className={styles.metric}>
            <div className={'flex items-center gap-2 text-xs font-medium text-gray-400'}>
                <Icon className={'w-4 h-4'} />
                {label}
            </div>
            <div className={'mt-2 flex items-baseline gap-1 min-w-0'}>
                <span
                    className={classNames('text-xl font-semibold tracking-tight truncate tabular-nums', {
                        'text-gray-500': offline,
                        'text-gray-50': !offline,
                    })}
                >
                    {offline ? 'Offline' : value}
                </span>
                {limit !== undefined && !offline && (
                    <span className={'text-xs text-gray-500 truncate'}>/ {limit || '∞'}</span>
                )}
            </div>
            {usage !== undefined && (
                <div className={styles.metric_bar}>
                    <div
                        className={classNames('h-full rounded-full transition-[width] duration-500', {
                            'bg-raptor-500': level === 'ok' || level === null,
                            'bg-yellow-400': level === 'warn',
                            'bg-red-500': level === 'danger',
                        })}
                        style={{ width: `${Math.min(100, Math.max(0, (offline ? 0 : usage || 0) * 100))}%` }}
                    />
                </div>
            )}
            {children}
        </div>
    );
};

const ServerDetailsBlock = ({ className }: { className?: string }) => {
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0, tx: 0, rx: 0 });

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : null,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : null,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : null,
        }),
        [limits]
    );

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        const stats = parseStats(data);
        if (!stats) return;

        setStats({
            memory: stats.memory_bytes,
            cpu: stats.cpu_absolute,
            disk: stats.disk_bytes,
            tx: stats.network.tx_bytes,
            rx: stats.network.rx_bytes,
            uptime: stats.uptime || 0,
        });
    });

    const offline = status === 'offline' || status === null;

    return (
        <div className={classNames('grid grid-cols-2 lg:grid-cols-5 gap-3', className)}>
            <Metric
                icon={ChipIcon}
                label={'CPU'}
                value={`${stats.cpu.toFixed(1)}%`}
                limit={textLimits.cpu}
                usage={limits.cpu ? stats.cpu / limits.cpu : null}
                offline={offline}
            />
            <Metric
                icon={ServerIcon}
                label={'Memory'}
                value={bytesToString(stats.memory)}
                limit={textLimits.memory}
                usage={limits.memory ? stats.memory / mbToBytes(limits.memory) : null}
                offline={offline}
            />
            <Metric
                icon={DatabaseIcon}
                label={'Disk'}
                value={bytesToString(stats.disk)}
                limit={textLimits.disk}
                usage={limits.disk ? stats.disk / mbToBytes(limits.disk) : null}
            />
            <Metric icon={ArrowDownIcon} label={'Network'} value={bytesToString(stats.rx)} offline={offline}>
                {!offline && (
                    <p className={'mt-1 flex items-center gap-1 text-xs text-gray-500'}>
                        <ArrowUpIcon className={'w-3 h-3'} /> {bytesToString(stats.tx)} sent
                    </p>
                )}
            </Metric>
            <div className={'col-span-2 lg:col-span-1'}>
                <Metric
                    icon={ClockIcon}
                    label={'Uptime'}
                    value={stats.uptime > 0 ? <UptimeDuration uptime={stats.uptime / 1000} /> : '—'}
                    offline={offline}
                />
            </div>
        </div>
    );
};

export default ServerDetailsBlock;
