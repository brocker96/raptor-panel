import React from 'react';
import { Link } from 'react-router-dom';
import { ChipIcon, PlusIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getNodes } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Badge, EmptyState, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { Pagination, SearchInput } from '@/components/admin/ui/DataTable';
import Button from '@/components/admin/ui/Button';
import { item } from '@/components/admin/ui/motion';
import { formatMb, useListParams } from '@/components/admin/ui/hooks';
import NodeStatus from '@/components/admin/nodes/NodeStatus';

export default () => {
    const list = useListParams();
    const { data } = useResource(['admin', 'nodes', list.query], (signal) => getNodes(list.query, signal), {
        keepPrevious: true,
    });

    return (
        <Page
            title={'Nodes'}
            icon={ChipIcon}
            description={'Machines running Wings. Status is checked live every 15 seconds.'}
            guide={'nodes'}
            actions={
                <Button icon={PlusIcon} to={'/admin/nodes/new'}>
                    New node
                </Button>
            }
        >
            <div>
                <SearchInput
                    value={list.search}
                    onChange={list.setSearch}
                    placeholder={'Search by name or FQDN…'}
                    className={'max-w-md'}
                />
            </div>
            {!data ? (
                <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className={'h-48 rounded-xl'} />
                    ))}
                </div>
            ) : data.data.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={ChipIcon}
                        title={list.search ? 'No nodes match' : 'No nodes yet'}
                        description={'A node is a machine running Wings, where servers are created.'}
                        action={
                            <div className={'flex gap-2 justify-center'}>
                                <Button variant={'secondary'} to={'/admin/guides/node-configuration'}>
                                    How to install Wings
                                </Button>
                                <Button icon={PlusIcon} to={'/admin/nodes/new'}>
                                    Create node
                                </Button>
                            </div>
                        }
                    />
                </Card>
            ) : (
                <>
                    <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                        {data.data.map((node) => {
                            const memoryMax = node.memory * (1 + Math.max(0, node.memory_overallocate) / 100);
                            const diskMax = node.disk * (1 + Math.max(0, node.disk_overallocate) / 100);

                            return (
                                <div
                                    key={node.id}
                                    className={'transition-transform duration-150 hover:-translate-y-0.5'}
                                >
                                    <Link
                                        to={`/admin/nodes/${node.id}`}
                                        className={
                                            'block h-full rounded-xl p-4 bg-gray-900/70 ring-1 ring-inset ring-gray-800 hover:ring-raptor-500/40 shadow-card no-underline transition-colors'
                                        }
                                    >
                                        <div className={'flex items-start gap-3'}>
                                            <span
                                                className={
                                                    'grid place-items-center w-10 h-10 rounded-lg bg-gray-800 ring-1 ring-inset ring-gray-700 text-gray-300'
                                                }
                                            >
                                                <ChipIcon className={'w-5 h-5'} />
                                            </span>
                                            <div className={'flex-1 min-w-0'}>
                                                <p className={'font-semibold text-gray-50 truncate'} title={node.name}>
                                                    {node.name}
                                                </p>
                                                <p className={'text-xs text-gray-500 font-mono truncate'}>
                                                    {node.scheme}://{node.fqdn}:{node.daemon_listen}
                                                </p>
                                            </div>
                                            <NodeStatus id={node.id} />
                                        </div>
                                        <div className={'mt-3 flex flex-wrap gap-1.5'}>
                                            {node.location && <Badge>{node.location.short}</Badge>}
                                            {node.maintenance_mode && <Badge tone={'yellow'}>Maintenance</Badge>}
                                            {!node.public && <Badge>Private</Badge>}
                                            <Badge tone={'blue'}>{node.usage.servers} servers</Badge>
                                        </div>
                                        <div className={'mt-4 space-y-3'}>
                                            <div>
                                                <div className={'flex justify-between text-2xs text-gray-500 mb-1'}>
                                                    <span>Memory</span>
                                                    <span className={'tabular-nums'}>
                                                        {formatMb(node.usage.memory)} / {formatMb(memoryMax)}
                                                    </span>
                                                </div>
                                                <Meter value={node.usage.memory} max={memoryMax} />
                                            </div>
                                            <div>
                                                <div className={'flex justify-between text-2xs text-gray-500 mb-1'}>
                                                    <span>Disk</span>
                                                    <span className={'tabular-nums'}>
                                                        {formatMb(node.usage.disk)} / {formatMb(diskMax)}
                                                    </span>
                                                </div>
                                                <Meter value={node.usage.disk} max={diskMax} />
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                    {data.meta.last_page > 1 && (
                        <Card flush>
                            <Pagination
                                page={data.meta.current_page}
                                lastPage={data.meta.last_page}
                                total={data.meta.total}
                                onChange={list.setPage}
                            />
                        </Card>
                    )}
                </>
            )}
        </Page>
    );
};
