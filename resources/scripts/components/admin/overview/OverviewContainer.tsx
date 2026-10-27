import Avatar from '@/components/Avatar';
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowCircleUpIcon,
    ChipIcon,
    CollectionIcon,
    ExclamationIcon,
    LightningBoltIcon,
    PlusIcon,
    ServerIcon,
    UsersIcon,
    ViewGridIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getOverview, getSystem, getUpdates, Overview } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import {
    Badge,
    Callout,
    CountUp,
    EmptyState,
    Meter,
    ServerStatusBadge,
    Skeleton,
    StatCard,
} from '@/components/admin/ui/Feedback';
import Button from '@/components/admin/ui/Button';
import { ago, formatMb } from '@/components/admin/ui/hooks';
import { useStoreState } from '@/state/hooks';
import { t } from '@/i18n';

const ActivityChart = ({ data }: { data: Overview['activity'] }) => {
    const width = 560;
    const height = 120;
    const max = Math.max(1, ...data.map((d) => d.total));
    const step = width / Math.max(1, data.length - 1);
    const points = data.map((d, i) => [i * step, height - 8 - (d.total / max) * (height - 24)] as const);
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;
    const total = data.reduce((sum, d) => sum + d.total, 0);

    return (
        <div>
            <p className={'text-2xl font-semibold text-gray-50'}>
                <CountUp value={total} />
                <span className={'ml-2 text-xs font-normal text-gray-500'}>{t('events in 14 days')}</span>
            </p>
            <svg viewBox={`0 0 ${width} ${height}`} className={'mt-3 w-full h-28'} preserveAspectRatio={'none'}>
                <defs>
                    <linearGradient id={'activity-fill'} x1={0} x2={0} y1={0} y2={1}>
                        <stop offset={'0%'} stopColor={'rgb(82 211 33)'} stopOpacity={0.35} />
                        <stop offset={'100%'} stopColor={'rgb(82 211 33)'} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <motion.path
                    d={area}
                    fill={'url(#activity-fill)'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                />
                <motion.path
                    d={line}
                    fill={'none'}
                    stroke={'rgb(111 227 63)'}
                    strokeWidth={2}
                    strokeLinejoin={'round'}
                    vectorEffect={'non-scaling-stroke'}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                />
            </svg>
            <div className={'flex justify-between text-2xs text-gray-600'}>
                <span>{data[0]?.day}</span>
                <span>{t('today')}</span>
            </div>
        </div>
    );
};

const ServerHealth = ({ servers }: { servers: Overview['servers'] }) => {
    const segments = [
        { key: 'installed', label: t('Installed'), value: servers.installed, color: 'bg-raptor-500' },
        {
            key: 'installing',
            label: t('Installing'),
            value: servers.installing + servers.restoring_backup,
            color: 'bg-sky-500',
        },
        { key: 'suspended', label: t('Suspended'), value: servers.suspended, color: 'bg-amber-400' },
        { key: 'failed', label: t('Install failed'), value: servers.install_failed, color: 'bg-rose-500' },
    ];
    const total = Math.max(
        1,
        segments.reduce((sum, s) => sum + s.value, 0)
    );

    return (
        <div>
            <div className={'flex h-3 rounded-full overflow-hidden bg-gray-800 gap-px'}>
                {segments.map((segment, i) =>
                    segment.value > 0 ? (
                        <motion.div
                            key={segment.key}
                            className={segment.color}
                            initial={{ width: 0 }}
                            animate={{ width: `${(segment.value / total) * 100}%` }}
                            transition={{ delay: 0.1 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        />
                    ) : null
                )}
            </div>
            <div className={'mt-4 grid grid-cols-2 gap-3'}>
                {segments.map((segment) => (
                    <Link
                        key={segment.key}
                        to={`/admin/servers?status=${segment.key}`}
                        className={'flex items-center gap-2 rounded-lg p-2 -m-2 hover:bg-white/5 no-underline'}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${segment.color}`} />
                        <span className={'flex-1 text-xs text-gray-400'}>{segment.label}</span>
                        <span className={'text-sm font-semibold text-gray-100 tabular-nums'}>{segment.value}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
};

const UpdateNotice = () => {
    const { data } = useResource(['admin', 'updates', false], (signal) => getUpdates(false, signal), {
        staleTime: 10 * 60_000,
        refetchOnWindowFocus: false,
    });

    if (!data?.update_available || !data.latest || !data.auto_check) return null;

    return (
        <div>
            <Callout
                tone={'green'}
                icon={ArrowCircleUpIcon}
                title={t('Raptor Panel {{version}} is available', { version: data.latest.version })}
            >
                {t(
                    'You are running {{current}}. The update makes a backup first and rolls back automatically if anything fails.',
                    { current: data.current }
                )}{' '}
                <Link to={'/admin/updates'} className={'font-medium underline'}>
                    {t('Review and update')}
                </Link>
            </Callout>
        </div>
    );
};

const SystemWarnings = () => {
    const { data } = useResource(['admin', 'system'], getSystem, { staleTime: 60_000 });
    const failing = data?.checks.filter((check) => !check.ok) || [];

    if (!failing.length) return null;

    return (
        <div>
            <Callout
                tone={'yellow'}
                icon={ExclamationIcon}
                title={t('{{count}} health {{value}} attention', {
                    count: failing.length,
                    value: failing.length === 1 ? 'check needs' : 'checks need',
                })}
            >
                {t('Not passing: {{value}}.', { value: failing.map((check) => check.label).join(' · ') })}{' '}
                <Link to={'/admin/system'} className={'font-medium underline'}>
                    {t('Open system health')}
                </Link>
            </Callout>
        </div>
    );
};

export default () => {
    const username = useStoreState((state) => state.user.data!.username);
    const { data } = useResource(['admin', 'overview'], getOverview, { refetchInterval: 60_000 });
    const hour = new Date().getHours();
    const greeting =
        hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return (
        <Page
            title={`${greeting}, ${username}`}
            icon={ViewGridIcon}
            description={t('A live overview of everything running on this Panel.')}
            guide={'overview'}
            actions={
                <>
                    <Button variant={'secondary'} icon={PlusIcon} to={'/admin/users'}>
                        {t('New user')}
                    </Button>
                    <Button icon={PlusIcon} to={'/admin/servers/new'}>
                        {t('New server')}
                    </Button>
                </>
            }
        >
            <UpdateNotice />
            <SystemWarnings />
            {!data ? (
                <div className={'grid gap-4 grid-cols-2 lg:grid-cols-4'}>
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className={'h-28 rounded-xl'} />
                    ))}
                </div>
            ) : (
                <>
                    <div className={'grid gap-4 grid-cols-2 lg:grid-cols-4'}>
                        <StatCard
                            label={t('Servers')}
                            value={data.counts.servers}
                            icon={ServerIcon}
                            href={'/admin/servers'}
                            hint={t('{{suspended}} suspended · {{install_failed}} failed', {
                                suspended: data.servers.suspended,
                                install_failed: data.servers.install_failed,
                            })}
                        />
                        <StatCard
                            label={t('Users')}
                            value={data.counts.users}
                            icon={UsersIcon}
                            tone={'blue'}
                            href={'/admin/users'}
                            hint={t('{{admins}} administrators', { admins: data.counts.admins })}
                        />
                        <StatCard
                            label={t('Nodes')}
                            value={data.counts.nodes}
                            icon={ChipIcon}
                            tone={'yellow'}
                            href={'/admin/nodes'}
                            hint={t('{{locations}} locations', { locations: data.counts.locations })}
                        />
                        <StatCard
                            label={t('Eggs')}
                            value={data.counts.eggs}
                            icon={CollectionIcon}
                            tone={'gray'}
                            href={'/admin/nests'}
                            hint={t('{{nests}} nests · {{databases}} databases', {
                                nests: data.counts.nests,
                                databases: data.counts.databases,
                            })}
                        />
                    </div>

                    {data.counts.nodes === 0 && (
                        <Card>
                            <EmptyState
                                icon={LightningBoltIcon}
                                title={t("Let's get your first server running")}
                                description={t(
                                    'Create a location and a node, add some ports and you are ready to deploy servers. The quick start guide walks you through it.'
                                )}
                                action={
                                    <div className={'flex flex-wrap justify-center gap-2'}>
                                        <Button variant={'secondary'} to={'/admin/guides/getting-started'}>
                                            {t('Read the quick start')}
                                        </Button>
                                        <Button to={'/admin/nodes/new'} icon={PlusIcon}>
                                            {t('Create a node')}
                                        </Button>
                                    </div>
                                }
                            />
                        </Card>
                    )}

                    <div className={'grid gap-6 lg:grid-cols-3'}>
                        <Card
                            title={t('Activity')}
                            description={t('Audit log events per day')}
                            className={'lg:col-span-2'}
                            actions={
                                <Button size={'sm'} variant={'ghost'} to={'/admin/activity'}>
                                    {t('View log')}
                                </Button>
                            }
                        >
                            <ActivityChart data={data.activity} />
                        </Card>
                        <Card title={t('Server health')} description={t('Installation and suspension state')}>
                            <ServerHealth servers={data.servers} />
                        </Card>
                    </div>

                    {data.nodes.length > 0 && (
                        <Card
                            title={t('Node capacity')}
                            description={t(
                                "Memory and disk assigned to servers, compared to each node's budget including overallocation."
                            )}
                            actions={
                                <Button size={'sm'} variant={'ghost'} to={'/admin/nodes'}>
                                    {t('All nodes')}
                                </Button>
                            }
                        >
                            <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                                {data.nodes.map((node) => {
                                    const memoryMax =
                                        node.memory.total * (1 + Math.max(0, node.memory.overallocate) / 100);
                                    const diskMax = node.disk.total * (1 + Math.max(0, node.disk.overallocate) / 100);

                                    return (
                                        <Link
                                            key={node.id}
                                            to={`/admin/nodes/${node.id}`}
                                            className={
                                                'block rounded-lg p-3 ring-1 ring-inset ring-gray-800 bg-gray-950/30 hover:ring-raptor-500/30 no-underline transition-colors'
                                            }
                                        >
                                            <div className={'flex items-center gap-2'}>
                                                <ChipIcon className={'w-4 h-4 text-gray-500'} />
                                                <span className={'flex-1 text-sm font-medium text-gray-100 truncate'}>
                                                    {node.name}
                                                </span>
                                                {node.maintenance_mode && (
                                                    <Badge tone={'yellow'}>{t('Maintenance')}</Badge>
                                                )}
                                                <span className={'text-xs text-gray-500'}>
                                                    {t('{{servers}} servers', { servers: node.servers })}
                                                </span>
                                            </div>
                                            <div className={'mt-3 space-y-2.5'}>
                                                <div>
                                                    <div className={'flex justify-between text-2xs text-gray-500 mb-1'}>
                                                        <span>{t('Memory')}</span>
                                                        <span className={'tabular-nums'}>
                                                            {formatMb(node.memory.used)} / {formatMb(memoryMax)}
                                                        </span>
                                                    </div>
                                                    <Meter value={node.memory.used} max={memoryMax} />
                                                </div>
                                                <div>
                                                    <div className={'flex justify-between text-2xs text-gray-500 mb-1'}>
                                                        <span>{t('Disk')}</span>
                                                        <span className={'tabular-nums'}>
                                                            {formatMb(node.disk.used)} / {formatMb(diskMax)}
                                                        </span>
                                                    </div>
                                                    <Meter value={node.disk.used} max={diskMax} />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    <div className={'grid gap-6 lg:grid-cols-2'}>
                        <Card title={t('Newest servers')} flush>
                            <ul className={'divide-y divide-gray-800'}>
                                {data.recent_servers.map((server) => (
                                    <li key={server.id}>
                                        <Link
                                            to={`/admin/servers/${server.id}`}
                                            className={
                                                'flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] no-underline'
                                            }
                                        >
                                            <ServerIcon className={'w-4 h-4 text-gray-500'} />
                                            <span className={'flex-1 min-w-0'}>
                                                <span className={'block text-sm text-gray-100 truncate'}>
                                                    {server.name}
                                                </span>
                                                <span className={'block text-xs text-gray-500'}>
                                                    {server.node} · {ago(server.created_at)}
                                                </span>
                                            </span>
                                            <ServerStatusBadge status={server.status} />
                                        </Link>
                                    </li>
                                ))}
                                {!data.recent_servers.length && (
                                    <li className={'px-5 py-6 text-sm text-gray-500'}>{t('No servers yet.')}</li>
                                )}
                            </ul>
                        </Card>
                        <Card title={t('Newest users')} flush>
                            <ul className={'divide-y divide-gray-800'}>
                                {data.recent_users.map((user) => (
                                    <li key={user.id}>
                                        <Link
                                            to={`/admin/users/${user.id}`}
                                            className={
                                                'flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] no-underline'
                                            }
                                        >
                                            <span className={'w-8 h-8 rounded-full overflow-hidden flex-shrink-0'}>
                                                <Avatar name={user.username} seed={user.uuid} src={user.avatar} />
                                            </span>
                                            <span className={'flex-1 min-w-0'}>
                                                <span className={'block text-sm text-gray-100 truncate'}>
                                                    {user.username}
                                                </span>
                                                <span className={'block text-xs text-gray-500 truncate'}>
                                                    {user.email} · {ago(user.created_at)}
                                                </span>
                                            </span>
                                            {user.root_admin && <Badge tone={'green'}>{t('Admin')}</Badge>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                </>
            )}
        </Page>
    );
};
