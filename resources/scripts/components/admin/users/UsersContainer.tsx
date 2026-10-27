import Avatar from '@/components/Avatar';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheckIcon, UserAddIcon, UsersIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AdminUser, createUser, getUsers, UserValues } from '@/api/admin';
import { Page, Segmented } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Column, DataTable, Pagination, SearchInput, Toolbar } from '@/components/admin/ui/DataTable';
import { Badge, EmptyState } from '@/components/admin/ui/Feedback';
import { Drawer } from '@/components/admin/ui/Overlay';
import Button from '@/components/admin/ui/Button';
import { ago, useAction, useListParams } from '@/components/admin/ui/hooks';
import UserForm from '@/components/admin/users/UserForm';

const empty: UserValues = { email: '', username: '', name_first: '', name_last: '', password: '', root_admin: false };

const columns: Column<AdminUser>[] = [
    {
        key: 'user',
        header: 'User',
        cell: (user) => (
            <div className={'flex items-center gap-3 min-w-0'}>
                <span className={'w-8 h-8 rounded-full overflow-hidden flex-shrink-0'}>
                    <Avatar name={user.username} seed={user.uuid} src={user.avatar} />
                </span>
                <div className={'min-w-0'}>
                    <p className={'font-medium text-gray-100 truncate'}>{user.username}</p>
                    <p className={'text-xs text-gray-500 truncate'}>{user.email}</p>
                </div>
            </div>
        ),
    },
    { key: 'name', header: 'Name', cell: (user) => user.name || '—', hideBelow: 'lg' },
    {
        key: 'flags',
        header: 'Access',
        cell: (user) => (
            <div className={'flex gap-1.5'}>
                {user.root_admin && <Badge tone={'green'}>Admin</Badge>}
                {user['2fa'] ? <Badge tone={'blue'}>2FA</Badge> : <Badge tone={'gray'}>No 2FA</Badge>}
            </div>
        ),
    },
    {
        key: 'servers',
        header: 'Servers',
        cell: (user) => <span className={'tabular-nums'}>{user.servers_count}</span>,
        hideBelow: 'md',
    },
    {
        key: 'created',
        header: 'Joined',
        cell: (user) => <span className={'text-gray-500'}>{ago(user.created_at)}</span>,
        hideBelow: 'xl',
    },
];

export default () => {
    const navigate = useNavigate();
    const list = useListParams(['filter']);
    const [creating, setCreating] = useState(false);
    const [values, setValues] = useState<UserValues>(empty);
    const { data, isValidating } = useResource(
        ['admin', 'users', list.query],
        (signal) => getUsers(list.query, signal),
        {
            keepPrevious: true,
        }
    );

    const create = useAction(createUser, {
        success: (user) => `${user.username} was created`,
        invalidate: [['admin', 'users']],
        onSuccess: (user) => navigate(`/admin/users/${user.id}`),
    });

    return (
        <Page
            title={'Users'}
            icon={UsersIcon}
            description={'Every account on the Panel. Administrators have access to this area.'}
            guide={'users'}
            actions={
                <Button icon={UserAddIcon} onClick={() => setCreating(true)}>
                    New user
                </Button>
            }
        >
            <Card flush>
                <Toolbar>
                    <SearchInput
                        value={list.search}
                        onChange={list.setSearch}
                        placeholder={'Search by username, e-mail, name or UUID…'}
                        className={'flex-1'}
                    />
                    <Segmented
                        id={'user-filter'}
                        value={list.filters.filter || 'all'}
                        onChange={(value) => list.setFilter('filter', value === 'all' ? '' : value)}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'admins', label: 'Admins' },
                            { value: '2fa', label: '2FA' },
                            { value: 'no-2fa', label: 'No 2FA' },
                        ]}
                    />
                </Toolbar>
                <DataTable
                    rows={data?.data}
                    loading={isValidating}
                    columns={columns}
                    rowKey={(user) => user.id}
                    onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
                    mobile={(user) => (
                        <div className={'flex items-center gap-3'}>
                            <span className={'w-9 h-9 rounded-full overflow-hidden flex-shrink-0'}>
                                <Avatar name={user.username} seed={user.uuid} src={user.avatar} />
                            </span>
                            <div className={'flex-1 min-w-0'}>
                                <p className={'text-sm font-medium text-gray-100 truncate'}>{user.username}</p>
                                <p className={'text-xs text-gray-500 truncate'}>
                                    {user.email} · {user.servers_count} servers
                                </p>
                            </div>
                            {user.root_admin && <ShieldCheckIcon className={'w-5 h-5 text-raptor-400'} />}
                        </div>
                    )}
                    empty={
                        <EmptyState
                            icon={UsersIcon}
                            title={'No users found'}
                            description={'Try another search or filter.'}
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
            <Drawer
                open={creating}
                onClose={() => setCreating(false)}
                icon={UserAddIcon}
                title={'New user'}
                description={'Create an account. The user can change their details later.'}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setCreating(false)}>
                            Cancel
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run(values)}>
                            Create user
                        </Button>
                    </>
                }
            >
                <UserForm values={values} onChange={setValues} errors={create.errors} creating />
            </Drawer>
        </Page>
    );
};
