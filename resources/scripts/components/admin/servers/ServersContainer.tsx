import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, ServerIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getNodes, getServers } from '@/api/admin';
import { Page, Segmented } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { DataTable, Pagination, SearchInput, Toolbar } from '@/components/admin/ui/DataTable';
import { EmptyState } from '@/components/admin/ui/Feedback';
import { Select } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { useListParams } from '@/components/admin/ui/hooks';
import { serverColumns, ServerMobileRow } from '@/components/admin/servers/ServerTable';

export default () => {
    const navigate = useNavigate();
    const list = useListParams(['status', 'node', 'owner', 'egg']);
    const { data, isValidating } = useResource(
        ['admin', 'servers', list.query],
        (signal) => getServers(list.query, signal),
        { keepPrevious: true }
    );
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));

    return (
        <Page
            title={'Servers'}
            icon={ServerIcon}
            description={'Every server on the Panel. Search matches names, owners, UUIDs and addresses.'}
            guide={'servers'}
            actions={
                <Button icon={PlusIcon} to={'/admin/servers/new'}>
                    New server
                </Button>
            }
        >
            <Card flush>
                <Toolbar>
                    <SearchInput
                        value={list.search}
                        onChange={list.setSearch}
                        placeholder={'Search name, owner, UUID, IP or port…'}
                        className={'flex-1'}
                    />
                    <Select
                        value={list.filters.node}
                        onChange={(v) => list.setFilter('node', v)}
                        placeholder={'All nodes'}
                        options={(nodes?.data || []).map((n) => ({ value: n.id, label: n.name }))}
                        className={'sm:w-44'}
                    />
                </Toolbar>
                <div className={'px-4 sm:px-5 pb-3 overflow-x-auto'}>
                    <Segmented
                        id={'server-status'}
                        value={list.filters.status || 'all'}
                        onChange={(value) => list.setFilter('status', value === 'all' ? '' : value)}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'installed', label: 'Installed' },
                            { value: 'installing', label: 'Installing' },
                            { value: 'failed', label: 'Failed' },
                            { value: 'suspended', label: 'Suspended' },
                        ]}
                    />
                </div>
                <DataTable
                    rows={data?.data}
                    loading={isValidating}
                    columns={serverColumns}
                    rowKey={(server) => server.id}
                    onRowClick={(server) => navigate(`/admin/servers/${server.id}`)}
                    mobile={(server) => <ServerMobileRow server={server} />}
                    empty={
                        <EmptyState
                            icon={ServerIcon}
                            title={
                                list.search || list.filters.status || list.filters.node
                                    ? 'No servers match'
                                    : 'No servers yet'
                            }
                            action={
                                <Button icon={PlusIcon} to={'/admin/servers/new'}>
                                    Create server
                                </Button>
                            }
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
