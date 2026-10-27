import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DatabaseIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    createDatabaseHost,
    DatabaseHost,
    DatabaseHostValues,
    deleteDatabaseHost,
    getDatabaseHost,
    getDatabaseHosts,
    getNodes,
    updateDatabaseHost,
} from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Column, DataTable } from '@/components/admin/ui/DataTable';
import { Badge, Callout, EmptyState } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { FormGrid, NumberInput, Select, TextInput } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { useAction } from '@/components/admin/ui/hooks';

const empty: DatabaseHostValues = { name: '', host: '', port: 3306, username: '', password: '', node_id: null };

const columns: Column<DatabaseHost>[] = [
    {
        key: 'name',
        header: 'Name',
        cell: (host) => (
            <div>
                <p className={'font-medium text-gray-100'}>{host.name}</p>
                <p className={'text-xs text-gray-500 font-mono'}>
                    {host.username}@{host.host}:{host.port}
                </p>
            </div>
        ),
    },
    {
        key: 'node',
        header: 'Linked node',
        cell: (host) => host.node?.name || <span className={'text-gray-600'}>None</span>,
        hideBelow: 'md',
    },
    {
        key: 'databases',
        header: 'Databases',
        cell: (host) => <Badge tone={host.databases ? 'green' : 'gray'}>{host.databases}</Badge>,
    },
];

const HostDatabases = ({ id }: { id: number }) => {
    const { data } = useResource(['admin', 'database-hosts', id], (signal) => getDatabaseHost(id, signal));

    if (!data) return null;
    if (!data.databases.length)
        return <p className={'text-sm text-gray-500'}>No databases have been created on this host yet.</p>;

    return (
        <ul className={'divide-y divide-gray-800 rounded-lg ring-1 ring-inset ring-gray-800'}>
            {data.databases.map((database) => (
                <li key={database.id} className={'flex items-center gap-3 px-3 py-2 text-sm'}>
                    <span className={'flex-1 min-w-0'}>
                        <span className={'block font-mono text-gray-100 truncate'}>{database.database}</span>
                        <span className={'block text-xs text-gray-500'}>
                            {database.username} · {database.remote}
                        </span>
                    </span>
                    {database.server && (
                        <Link
                            to={`/admin/servers/${database.server.id}`}
                            className={'text-xs text-raptor-300 hover:text-raptor-200'}
                        >
                            {database.server.name}
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default () => {
    const { data } = useResource(['admin', 'database-hosts'], getDatabaseHosts);
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));
    const [editing, setEditing] = useState<DatabaseHost | 'new' | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [values, setValues] = useState<DatabaseHostValues>(empty);
    const set =
        <K extends keyof DatabaseHostValues>(key: K) =>
        (value: DatabaseHostValues[K]) =>
            setValues({ ...values, [key]: value });

    const open = (host: DatabaseHost | 'new') => {
        setValues(
            host === 'new'
                ? empty
                : {
                      name: host.name,
                      host: host.host,
                      port: host.port,
                      username: host.username,
                      password: '',
                      node_id: host.node?.id || null,
                  }
        );
        setEditing(host);
    };

    const save = useAction(
        () =>
            editing === 'new' ? createDatabaseHost(values) : updateDatabaseHost((editing as DatabaseHost).id, values),
        {
            success: 'Connection verified and host saved',
            invalidate: [['admin', 'database-hosts']],
            onSuccess: () => setEditing(null),
        }
    );
    const remove = useAction(() => deleteDatabaseHost((editing as DatabaseHost).id), {
        success: 'Database host deleted',
        invalidate: [['admin', 'database-hosts']],
        onSuccess: () => {
            setDeleting(false);
            setEditing(null);
        },
    });

    return (
        <Page
            title={'Database hosts'}
            icon={DatabaseIcon}
            description={'MySQL / MariaDB servers the Panel creates databases on for game servers.'}
            guide={'database-hosts'}
            actions={
                <Button icon={PlusIcon} onClick={() => open('new')}>
                    New host
                </Button>
            }
        >
            <Card flush>
                <DataTable
                    rows={data}
                    columns={columns}
                    rowKey={(host) => host.id}
                    onRowClick={open}
                    empty={
                        <EmptyState
                            icon={DatabaseIcon}
                            title={'No database hosts'}
                            description={'Add a MySQL or MariaDB server so that servers can get their own databases.'}
                            action={
                                <Button icon={PlusIcon} onClick={() => open('new')}>
                                    Add database host
                                </Button>
                            }
                        />
                    }
                />
            </Card>
            <Drawer
                open={editing !== null}
                onClose={() => setEditing(null)}
                icon={DatabaseIcon}
                title={editing === 'new' ? 'New database host' : 'Edit database host'}
                description={'The connection is tested when saving.'}
                footer={
                    <>
                        {editing !== 'new' && (
                            <Button
                                variant={'danger'}
                                icon={TrashIcon}
                                className={'mr-auto'}
                                disabled={!!(editing as DatabaseHost)?.databases}
                                onClick={() => setDeleting(true)}
                            >
                                Delete
                            </Button>
                        )}
                        <Button variant={'ghost'} onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                        <Button loading={save.loading} onClick={() => save.run()}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={'Name'}
                        required
                        value={values.name}
                        onChange={set('name')}
                        error={save.errors.name}
                        placeholder={'EU database'}
                    />
                    <FormGrid>
                        <TextInput
                            label={'Host'}
                            required
                            value={values.host}
                            onChange={set('host')}
                            error={save.errors.host}
                            placeholder={'203.0.113.10'}
                        />
                        <NumberInput
                            label={'Port'}
                            required
                            value={values.port}
                            onChange={set('port')}
                            error={save.errors.port}
                        />
                        <TextInput
                            label={'Username'}
                            required
                            value={values.username}
                            onChange={set('username')}
                            error={save.errors.username}
                            autoComplete={'off'}
                        />
                        <TextInput
                            label={'Password'}
                            type={'password'}
                            value={values.password}
                            onChange={set('password')}
                            error={save.errors.password}
                            autoComplete={'new-password'}
                            description={editing !== 'new' ? 'Leave empty to keep the current password.' : undefined}
                        />
                    </FormGrid>
                    <Select
                        label={'Linked node'}
                        value={values.node_id ?? ''}
                        onChange={(v) => set('node_id')(v ? Number(v) : null)}
                        placeholder={'None'}
                        options={(nodes?.data || []).map((node) => ({ value: node.id, label: node.name }))}
                        description={'Databases for servers on this node are preferably created on this host.'}
                    />
                    <Callout tone={'blue'} title={'The user needs to be able to create users'}>
                        Run{' '}
                        <code>GRANT ALL PRIVILEGES ON *.* TO &apos;user&apos;@&apos;%&apos; WITH GRANT OPTION;</code> on
                        the database server. The guide explains the full setup.
                    </Callout>
                    {editing && editing !== 'new' && (
                        <div>
                            <p className={'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'}>
                                Databases on this host
                            </p>
                            <HostDatabases id={editing.id} />
                        </div>
                    )}
                </div>
            </Drawer>
            <Confirm
                open={deleting}
                title={'Delete this database host?'}
                confirm={'Delete'}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setDeleting(false)}
            >
                The Panel forgets the host. Databases on the server itself are not touched.
            </Confirm>
        </Page>
    );
};
