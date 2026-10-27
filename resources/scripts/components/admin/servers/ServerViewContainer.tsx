import React, { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import {
    AdjustmentsIcon,
    ClipboardListIcon,
    CogIcon,
    DatabaseIcon,
    ClipboardCopyIcon,
    FolderIcon,
    InformationCircleIcon,
    KeyIcon,
    LockClosedIcon,
    LockOpenIcon,
    PlayIcon,
    PlusIcon,
    RefreshIcon,
    ServerIcon,
    SwitchHorizontalIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    AdminServerDetails,
    attachServerMount,
    createServerDatabase,
    deleteServer,
    deleteServerDatabase,
    detachServerMount,
    getDatabaseHosts,
    getNodeAllocations,
    getNodes,
    getNests,
    getServer,
    reinstallServer,
    resetServerDatabasePassword,
    suspendServer,
    toggleServerInstall,
    transferServer,
    updateServerBuild,
    updateServerDetails,
    updateServerStartup,
} from '@/api/admin';
import { Page, Tabs } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import { Badge, Callout, EmptyState, ServerStatusBadge, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { FormGrid, NumberInput, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import Button, { IconButton } from '@/components/admin/ui/Button';
import UserPicker from '@/components/admin/ui/UserPicker';
import CheckList from '@/components/admin/ui/CheckList';
import { toast } from '@/components/admin/ui/Toast';
import { formatMb, useAction } from '@/components/admin/ui/hooks';
import { NotFound } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

type Props = { server: AdminServerDetails };

const invalidate = (id: number) => [
    ['admin', 'servers'],
    ['admin', 'servers', id],
];

const About = ({ server }: Props) => {
    const [name, setName] = useState(server.name);
    const [owner, setOwner] = useState(server.owner);
    const [description, setDescription] = useState(server.description || '');
    const [externalId, setExternalId] = useState(server.external_id || '');

    const save = useAction(
        () =>
            updateServerDetails(server.id, {
                name,
                user: owner?.id || 0,
                description,
                external_id: externalId || null,
            }),
        { success: t('Server details saved'), invalidate: invalidate(server.id) }
    );

    return (
        <div className={'grid gap-6 lg:grid-cols-3'}>
            <Card
                title={t('Details')}
                className={'lg:col-span-2'}
                footer={
                    <Button loading={save.loading} onClick={() => save.run()}>
                        {t('Save')}
                    </Button>
                }
            >
                <div className={'space-y-4'}>
                    <FormGrid>
                        <TextInput
                            label={t('Name')}
                            required
                            value={name}
                            onChange={setName}
                            error={save.errors.name}
                        />
                        <UserPicker
                            value={owner}
                            onChange={setOwner}
                            error={save.errors.user}
                            description={t('Changing the owner moves the server to their dashboard.')}
                        />
                    </FormGrid>
                    <TextArea label={t('Description')} value={description} onChange={setDescription} rows={3} />
                    <TextInput
                        label={t('External ID')}
                        value={externalId}
                        onChange={setExternalId}
                        error={save.errors.external_id}
                    />
                </div>
            </Card>
            <Card title={t('Summary')}>
                <Details
                    items={[
                        [t('Status'), <ServerStatusBadge key={'s'} status={server.status} />],
                        [
                            t('Node'),
                            server.node && (
                                <Link key={'n'} to={`/admin/nodes/${server.node.id}`}>
                                    {server.node.name}
                                </Link>
                            ),
                        ],
                        [
                            t('Egg'),
                            server.egg && (
                                <Link key={'e'} to={`/admin/nests/eggs/${server.egg.id}`}>
                                    {server.egg.name}
                                </Link>
                            ),
                        ],
                        [
                            t('Address'),
                            server.allocation && (
                                <code key={'a'}>{`${server.allocation.alias || server.allocation.ip}:${
                                    server.allocation.port
                                }`}</code>
                            ),
                        ],
                        [t('Memory / disk'), `${formatMb(server.limits.memory)} / ${formatMb(server.limits.disk)}`],
                        [t('CPU'), server.limits.cpu ? `${server.limits.cpu}%` : t('Unlimited')],
                        [
                            t('UUID'),
                            <code key={'u'} className={'text-xs break-all'}>
                                {server.uuid}
                            </code>,
                        ],
                    ]}
                />
            </Card>
        </div>
    );
};

const Build = ({ server }: Props) => {
    const [limits, setLimits] = useState({ ...server.limits });
    const [features, setFeatures] = useState({
        databases: server.feature_limits.databases ?? 0,
        allocations: server.feature_limits.allocations ?? 0,
        backups: server.feature_limits.backups ?? 0,
    });
    const [primary, setPrimary] = useState(server.allocation_id);
    const [add, setAdd] = useState<number[]>([]);
    const [remove, setRemove] = useState<number[]>([]);
    const { data: free } = useResource(['admin', 'nodes', server.node?.id, 'allocations', 'free'], (signal) =>
        getNodeAllocations(server.node!.id, { filter: 'unassigned', per_page: 100 }, signal)
    );

    const save = useAction(
        () =>
            updateServerBuild(server.id, {
                allocation: primary,
                oom_disabled: limits.oom_disabled,
                limits: {
                    memory: limits.memory,
                    swap: limits.swap,
                    disk: limits.disk,
                    io: limits.io,
                    cpu: limits.cpu,
                    threads: limits.threads || null,
                },
                feature_limits: features,
                add_allocations: add,
                remove_allocations: remove,
            }),
        {
            success: t('Build configuration saved'),
            invalidate: [...invalidate(server.id), ['admin', 'nodes']],
            onSuccess: () => {
                setAdd([]);
                setRemove([]);
            },
        }
    );
    const err = (k: string) => save.errors[k];

    return (
        <div className={'space-y-6'}>
            <Card
                title={t('Resources')}
                icon={AdjustmentsIcon}
                description={t('Memory, CPU and IO changes apply to the running container immediately.')}
            >
                <div className={'space-y-4'}>
                    <FormGrid cols={3}>
                        <NumberInput
                            label={t('Memory')}
                            suffix={'MiB'}
                            value={limits.memory}
                            onChange={(memory) => setLimits({ ...limits, memory })}
                            error={err('limits.memory')}
                            description={formatMb(limits.memory)}
                        />
                        <NumberInput
                            label={t('Swap')}
                            suffix={'MiB'}
                            value={limits.swap}
                            onChange={(swap) => setLimits({ ...limits, swap })}
                            error={err('limits.swap')}
                            description={t('0 disables, -1 unlimited')}
                        />
                        <NumberInput
                            label={t('Disk')}
                            suffix={'MiB'}
                            value={limits.disk}
                            onChange={(disk) => setLimits({ ...limits, disk })}
                            error={err('limits.disk')}
                            description={formatMb(limits.disk)}
                        />
                        <NumberInput
                            label={t('CPU')}
                            suffix={'%'}
                            value={limits.cpu}
                            onChange={(cpu) => setLimits({ ...limits, cpu })}
                            error={err('limits.cpu')}
                            description={t('100% = one thread, 0 unlimited')}
                        />
                        <NumberInput
                            label={t('Block IO weight')}
                            value={limits.io}
                            onChange={(io) => setLimits({ ...limits, io })}
                            error={err('limits.io')}
                        />
                        <TextInput
                            label={t('CPU pinning')}
                            value={limits.threads || ''}
                            onChange={(threads) => setLimits({ ...limits, threads })}
                            error={err('limits.threads')}
                            placeholder={'0-3'}
                        />
                    </FormGrid>
                    <Toggle
                        label={t('Disable OOM killer')}
                        checked={limits.oom_disabled}
                        onChange={(oom_disabled) => setLimits({ ...limits, oom_disabled })}
                    />
                </div>
            </Card>
            <Card title={t('Feature limits')} description={t('What the owner can create on their own.')}>
                <FormGrid cols={3}>
                    <NumberInput
                        label={t('Databases')}
                        value={features.databases}
                        onChange={(databases) => setFeatures({ ...features, databases })}
                        error={err('feature_limits.databases')}
                    />
                    <NumberInput
                        label={t('Allocations')}
                        value={features.allocations}
                        onChange={(allocations) => setFeatures({ ...features, allocations })}
                        error={err('feature_limits.allocations')}
                    />
                    <NumberInput
                        label={t('Backups')}
                        value={features.backups}
                        onChange={(backups) => setFeatures({ ...features, backups })}
                        error={err('feature_limits.backups')}
                    />
                </FormGrid>
            </Card>
            <Card
                title={t('Allocations')}
                icon={SwitchHorizontalIcon}
                description={t('Port changes need a restart of the server.')}
            >
                <div className={'space-y-4'}>
                    <Select
                        label={t('Primary allocation')}
                        value={primary}
                        onChange={(v) => setPrimary(Number(v))}
                        error={err('allocation')}
                        options={server.allocations
                            .filter((a) => !remove.includes(a.id))
                            .map((a) => ({ value: a.id, label: `${a.alias || a.ip}:${a.port}` }))}
                    />
                    <FormGrid>
                        <div>
                            <p className={'mb-1.5 text-xs font-medium text-gray-300'}>
                                {t('Remove additional allocations')}
                            </p>
                            <CheckList
                                options={server.allocations
                                    .filter((a) => a.id !== primary)
                                    .map((a) => ({ id: a.id, label: `${a.alias || a.ip}:${a.port}` }))}
                                selected={remove}
                                onChange={setRemove}
                            />
                        </div>
                        <div>
                            <p className={'mb-1.5 text-xs font-medium text-gray-300'}>
                                {t('Add free allocations of {{name}}', { name: server.node?.name })}
                            </p>
                            <CheckList
                                options={(free?.data || []).map((a) => ({
                                    id: a.id,
                                    label: `${a.alias || a.ip}:${a.port}`,
                                }))}
                                selected={add}
                                onChange={setAdd}
                                placeholder={t('Filter ports…')}
                            />
                        </div>
                    </FormGrid>
                </div>
            </Card>
            <div className={'flex justify-end'}>
                <Button loading={save.loading} onClick={() => save.run()}>
                    {t('Save build configuration')}
                </Button>
            </div>
        </div>
    );
};

const Startup = ({ server }: Props) => {
    const { data: nests } = useResource(['admin', 'nests'], getNests);
    const [startup, setStartup] = useState(server.container.startup);
    const [image, setImage] = useState(server.container.image);
    const [skip, setSkip] = useState(server.container.skip_scripts);
    const [egg, setEgg] = useState(server.egg?.id || 0);
    const [environment, setEnvironment] = useState<Record<string, string>>(
        Object.fromEntries(server.variables.map((v) => [v.env_variable, v.server_value ?? v.default_value ?? '']))
    );

    const save = useAction(
        () => updateServerStartup(server.id, { startup, image, skip_scripts: skip, egg, environment }),
        {
            success: t('Startup configuration saved'),
            invalidate: invalidate(server.id),
        }
    );
    const changingEgg = egg !== server.egg?.id;

    return (
        <div className={'space-y-6'}>
            <Card title={t('Startup command')}>
                <div className={'space-y-3'}>
                    <TextArea mono rows={3} value={startup} onChange={setStartup} error={save.errors.startup} />
                    {server.container.default_startup && startup !== server.container.default_startup && (
                        <Button
                            size={'sm'}
                            variant={'ghost'}
                            icon={RefreshIcon}
                            onClick={() => setStartup(server.container.default_startup!)}
                        >
                            {t('Reset to egg default')}
                        </Button>
                    )}
                </div>
            </Card>
            <Card title={t('Egg and image')}>
                <div className={'space-y-4'}>
                    <FormGrid>
                        <Select
                            label={t('Egg')}
                            value={egg}
                            onChange={(v) => setEgg(Number(v))}
                            error={save.errors.egg}
                            options={(nests || []).flatMap((nest) =>
                                nest.eggs.map((e) => ({ value: e.id, label: `${nest.name} → ${e.name}` }))
                            )}
                        />
                        <TextInput
                            label={t('Docker image')}
                            value={image}
                            onChange={setImage}
                            error={save.errors.image}
                            className={'font-mono'}
                        />
                    </FormGrid>
                    {!changingEgg && Object.keys(server.container.images).length > 0 && (
                        <div className={'flex flex-wrap gap-1.5'}>
                            {Object.entries(server.container.images).map(([label, value]) => (
                                <button
                                    key={value}
                                    type={'button'}
                                    onClick={() => setImage(value)}
                                    className={`h-7 px-2.5 rounded-full text-xs ${
                                        image === value
                                            ? 'bg-raptor-500 text-gray-950'
                                            : 'bg-gray-800 text-gray-300 hover:text-white'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                    {changingEgg && (
                        <Callout tone={'yellow'}>
                            {t(
                                'Changing the egg keeps the files of the server. Save, then check the variables and reinstall the server from the Manage tab if needed.'
                            )}
                        </Callout>
                    )}
                    <Toggle
                        label={t('Skip egg install script')}
                        description={t('Reinstalling will not run the install script.')}
                        checked={skip}
                        onChange={setSkip}
                    />
                </div>
            </Card>
            {!changingEgg && (
                <Card
                    title={t('Variables')}
                    description={t('As an administrator you can edit every variable, including hidden ones.')}
                >
                    <FormGrid>
                        {server.variables.map((variable) => (
                            <TextInput
                                key={variable.id}
                                label={
                                    <>
                                        {variable.name}
                                        {!variable.user_viewable && <Badge className={'ml-1'}>{t('Hidden')}</Badge>}
                                    </>
                                }
                                value={environment[variable.env_variable] ?? ''}
                                onChange={(v) => setEnvironment({ ...environment, [variable.env_variable]: v })}
                                error={save.errors[`environment.${variable.env_variable}`]}
                                description={`{{${variable.env_variable}}} · ${variable.rules}`}
                            />
                        ))}
                    </FormGrid>
                </Card>
            )}
            <div className={'flex justify-end'}>
                <Button loading={save.loading} onClick={() => save.run()}>
                    {t('Save startup')}
                </Button>
            </div>
        </div>
    );
};

const Databases = ({ server }: Props) => {
    const { data: hosts } = useResource(['admin', 'database-hosts'], getDatabaseHosts);
    const [creating, setCreating] = useState(false);
    const [values, setValues] = useState({ database: '', remote: '%', host: 0 });
    const [deleting, setDeleting] = useState<number | null>(null);

    const create = useAction(
        () => createServerDatabase(server.id, { ...values, host: values.host || hosts?.[0]?.id || 0 }),
        {
            success: t('Database created'),
            invalidate: invalidate(server.id),
            onSuccess: () => setCreating(false),
        }
    );
    const rotate = useAction((database: number) => resetServerDatabasePassword(server.id, database), {
        success: t('Password rotated'),
    });
    const remove = useAction((database: number) => deleteServerDatabase(server.id, database), {
        success: t('Database deleted'),
        invalidate: invalidate(server.id),
        onSuccess: () => setDeleting(null),
    });

    return (
        <Card
            title={t('Databases')}
            icon={DatabaseIcon}
            description={t('{{count}} of {{value}} databases the owner may create.', {
                count: server.databases.length,
                value: server.feature_limits.databases ?? '∞',
            })}
            flush
            actions={
                <Button size={'sm'} icon={PlusIcon} disabled={!hosts?.length} onClick={() => setCreating(true)}>
                    {t('New database')}
                </Button>
            }
        >
            {hosts && !hosts.length && (
                <div className={'px-5 pb-5'}>
                    <Callout tone={'yellow'}>
                        {t('No database hosts are configured.')} <Link to={'/admin/databases'}>{t('Add one')}</Link>{' '}
                        {t('first.')}
                    </Callout>
                </div>
            )}
            {server.databases.length === 0 ? (
                <EmptyState icon={DatabaseIcon} title={t('No databases')} />
            ) : (
                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                    {server.databases.map((db) => (
                        <li key={db.id} className={'flex items-center gap-3 px-5 py-3'}>
                            <div className={'flex-1 min-w-0'}>
                                <p className={'text-sm font-mono text-gray-100 truncate'}>{db.database}</p>
                                <p className={'text-xs text-gray-500 truncate'}>
                                    {t('{{username}} · {{address}} · from {{remote}}', {
                                        username: db.username,
                                        address: db.host?.address,
                                        remote: db.remote,
                                    })}
                                </p>
                            </div>
                            <IconButton icon={KeyIcon} label={t('Rotate password')} onClick={() => rotate.run(db.id)} />
                            <IconButton
                                icon={TrashIcon}
                                label={t('Delete')}
                                tone={'danger'}
                                onClick={() => setDeleting(db.id)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            <Drawer
                open={creating}
                onClose={() => setCreating(false)}
                icon={DatabaseIcon}
                title={t('New database')}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setCreating(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run()}>
                            {t('Create')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <Select
                        label={t('Host')}
                        value={values.host || hosts?.[0]?.id || ''}
                        onChange={(v) => setValues({ ...values, host: Number(v) })}
                        options={(hosts || []).map((h) => ({ value: h.id, label: `${h.name} (${h.host})` }))}
                    />
                    <TextInput
                        label={t('Name')}
                        required
                        value={values.database}
                        onChange={(database) => setValues({ ...values, database })}
                        error={create.errors.database}
                        description={t('Created as s{{id}}_<name>.', { id: server.id })}
                    />
                    <TextInput
                        label={t('Connections from')}
                        value={values.remote}
                        onChange={(remote) => setValues({ ...values, remote })}
                        error={create.errors.remote}
                        description={t('% allows every address. Use the node IP to only allow the server itself.')}
                    />
                </div>
            </Drawer>
            <Confirm
                open={deleting !== null}
                title={t('Delete this database?')}
                confirm={t('Delete')}
                loading={remove.loading}
                onConfirm={() => deleting && remove.run(deleting)}
                onClose={() => setDeleting(null)}
            >
                {t('All tables and data are deleted from the database host.')}
            </Confirm>
        </Card>
    );
};

const Mounts = ({ server }: Props) => {
    const toggle = useAction(
        (mount: number, attached: boolean) =>
            attached ? detachServerMount(server.id, mount) : attachServerMount(server.id, mount),
        {
            success: t('Mounts updated, restart the server to apply'),
            invalidate: invalidate(server.id),
        }
    );

    return (
        <Card
            title={t('Mounts')}
            icon={FolderIcon}
            description={t('Mounts linked to both the egg and the node of this server.')}
            flush
        >
            {server.mounts.length === 0 ? (
                <EmptyState
                    icon={FolderIcon}
                    title={t('No mounts available')}
                    description={t('Link a mount to this egg and node on the Mounts page to make it available here.')}
                    action={
                        <Button variant={'secondary'} to={'/admin/mounts'}>
                            {t('Manage mounts')}
                        </Button>
                    }
                />
            ) : (
                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                    {server.mounts.map((mount) => (
                        <li key={mount.id} className={'flex items-center gap-3 px-5 py-3'}>
                            <div className={'flex-1 min-w-0'}>
                                <p className={'text-sm text-gray-100'}>
                                    {mount.name} {mount.read_only && <Badge className={'ml-1'}>{t('Read only')}</Badge>}
                                </p>
                                <p className={'text-xs text-gray-500 font-mono truncate'}>
                                    {mount.source} → {mount.target}
                                </p>
                            </div>
                            <Button
                                size={'sm'}
                                variant={mount.attached ? 'danger' : 'secondary'}
                                onClick={() => toggle.run(mount.id, mount.attached)}
                            >
                                {mount.attached ? t('Detach') : t('Attach')}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
};

const Manage = ({ server }: Props) => {
    const navigate = useNavigate();
    const [confirm, setConfirm] = useState<'reinstall' | 'suspend' | 'delete' | 'force' | null>(null);
    const [transferring, setTransferring] = useState(false);
    const [target, setTarget] = useState({ node: 0, allocation: 0, additional: [] as number[] });
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));
    const { data: targetAllocations } = useResource(
        ['admin', 'nodes', target.node, 'allocations', 'free'],
        (signal) => getNodeAllocations(target.node, { filter: 'unassigned', per_page: 100 }, signal),
        { enabled: target.node > 0 }
    );

    const done = { invalidate: invalidate(server.id), onSuccess: () => setConfirm(null) };
    const reinstall = useAction(() => reinstallServer(server.id), { success: t('Reinstall started'), ...done });
    const suspend = useAction(() => suspendServer(server.id, !server.suspended), {
        success: server.suspended ? t('Server unsuspended') : t('Server suspended'),
        ...done,
    });
    const toggleInstall = useAction(() => toggleServerInstall(server.id), {
        success: t('Install status toggled'),
        invalidate: invalidate(server.id),
    });
    const transfer = useAction(
        () =>
            transferServer(server.id, {
                node_id: target.node,
                allocation_id: target.allocation,
                allocation_additional: target.additional,
            }),
        {
            success: t('Transfer started'),
            invalidate: invalidate(server.id),
            onSuccess: () => setTransferring(false),
        }
    );
    const remove = useAction((force: boolean) => deleteServer(server.id, force), {
        success: t('Server deleted'),
        invalidate: [
            ['admin', 'servers'],
            ['admin', 'overview'],
        ],
        onSuccess: () => navigate('/admin/servers'),
    });

    const actions = [
        {
            icon: RefreshIcon,
            title: t('Reinstall'),
            text: t('Runs the install script of the egg again. Most eggs keep worlds and configs.'),
            button: (
                <Button variant={'secondary'} onClick={() => setConfirm('reinstall')}>
                    {t('Reinstall')}
                </Button>
            ),
        },
        {
            icon: server.suspended ? LockOpenIcon : LockClosedIcon,
            title: server.suspended ? t('Unsuspend') : t('Suspend'),
            text: server.suspended
                ? t('Gives the owner access to the server again.')
                : t('Stops the server and locks the owner and subusers out. Nothing is deleted.'),
            button: (
                <Button variant={server.suspended ? 'primary' : 'secondary'} onClick={() => setConfirm('suspend')}>
                    {server.suspended ? t('Unsuspend') : t('Suspend')}
                </Button>
            ),
        },
        {
            icon: CogIcon,
            title: t('Toggle install status'),
            text: t(
                'Marks the server as {{value}} without running anything. Fixes servers stuck after an interrupted install.',
                { value: server.status === 'installing' ? 'installed' : 'installing' }
            ),
            button: (
                <Button
                    variant={'secondary'}
                    loading={toggleInstall.loading}
                    disabled={server.status === 'install_failed'}
                    onClick={() => toggleInstall.run()}
                >
                    {t('Toggle')}
                </Button>
            ),
        },
        {
            icon: SwitchHorizontalIcon,
            title: t('Transfer'),
            text: server.transfer
                ? t('A transfer is already in progress.')
                : t('Moves the server and its files to another node.'),
            button: (
                <Button variant={'secondary'} disabled={!!server.transfer} onClick={() => setTransferring(true)}>
                    {t('Transfer')}
                </Button>
            ),
        },
    ];

    return (
        <div className={'space-y-6'}>
            {server.transfer && (
                <Callout tone={'blue'} icon={SwitchHorizontalIcon} title={t('Transfer in progress')}>
                    {t(
                        'The server is being moved to node #{{new_node}}. It cannot be started until the transfer finished.',
                        { new_node: server.transfer.new_node }
                    )}
                </Callout>
            )}
            <div className={'grid gap-4 md:grid-cols-2'}>
                {actions.map((action) => (
                    <Card key={action.title} title={action.title} icon={action.icon} description={action.text}>
                        {action.button}
                    </Card>
                ))}
            </div>
            <Card
                title={t('Delete server')}
                danger
                icon={TrashIcon}
                description={t(
                    'Removes the server, its files and backups from the node and its databases from their host. This cannot be undone.'
                )}
            >
                <div className={'flex flex-wrap gap-2'}>
                    <Button variant={'danger'} onClick={() => setConfirm('delete')}>
                        {t('Delete server')}
                    </Button>
                    <Button variant={'ghost'} onClick={() => setConfirm('force')}>
                        {t('Force delete')}
                    </Button>
                </div>
            </Card>

            <Confirm
                open={confirm === 'reinstall'}
                title={t('Reinstall this server?')}
                confirm={t('Reinstall')}
                loading={reinstall.loading}
                onConfirm={() => reinstall.run()}
                onClose={() => setConfirm(null)}
            >
                {t(
                    'The server is stopped and the install script runs again. Some install scripts delete existing files, create a backup if in doubt.'
                )}
            </Confirm>
            <Confirm
                open={confirm === 'suspend'}
                danger={!server.suspended}
                title={server.suspended ? t('Unsuspend this server?') : t('Suspend this server?')}
                confirm={server.suspended ? t('Unsuspend') : t('Suspend')}
                loading={suspend.loading}
                onConfirm={() => suspend.run()}
                onClose={() => setConfirm(null)}
            >
                {server.suspended
                    ? t('The owner can start and manage the server again.')
                    : t('The server is stopped and the owner cannot access it until you unsuspend it.')}
            </Confirm>
            <Confirm
                open={confirm === 'delete' || confirm === 'force'}
                title={confirm === 'force' ? t('Force delete this server?') : t('Delete this server?')}
                challenge={server.name}
                confirm={t('Delete forever')}
                loading={remove.loading}
                onConfirm={() => remove.run(confirm === 'force')}
                onClose={() => setConfirm(null)}
            >
                {confirm === 'force'
                    ? t(
                          'The server is removed from the Panel even if Wings cannot be reached. Files may remain on the node.'
                      )
                    : t('All files, backups and databases of the server are deleted.')}
            </Confirm>
            <Drawer
                open={transferring}
                onClose={() => setTransferring(false)}
                icon={SwitchHorizontalIcon}
                title={t('Transfer server')}
                description={t('Currently on {{name}}. Needs {{formatMb}} memory and {{formatMb2}} disk.', {
                    name: server.node?.name,
                    formatMb: formatMb(server.limits.memory),
                    formatMb2: formatMb(server.limits.disk),
                })}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setTransferring(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            loading={transfer.loading}
                            disabled={!target.node || !target.allocation}
                            onClick={() => transfer.run()}
                        >
                            {t('Start transfer')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <Select
                        label={t('Target node')}
                        value={target.node || ''}
                        onChange={(v) => setTarget({ node: Number(v), allocation: 0, additional: [] })}
                        placeholder={t('Choose a node')}
                        options={(nodes?.data || [])
                            .filter((n) => n.id !== server.node?.id)
                            .map((n) => ({ value: n.id, label: n.name }))}
                    />
                    {target.node > 0 && targetAllocations && (
                        <>
                            <Select
                                label={t('Primary allocation')}
                                value={target.allocation || ''}
                                onChange={(v) => setTarget({ ...target, allocation: Number(v) })}
                                placeholder={t('Choose a port')}
                                error={transfer.errors.allocation_id}
                                options={targetAllocations.data.map((a) => ({
                                    value: a.id,
                                    label: `${a.alias || a.ip}:${a.port}`,
                                }))}
                            />
                            <div>
                                <p className={'mb-1.5 text-xs font-medium text-gray-300'}>
                                    {t('Additional allocations')}
                                </p>
                                <CheckList
                                    options={targetAllocations.data
                                        .filter((a) => a.id !== target.allocation)
                                        .map((a) => ({ id: a.id, label: `${a.alias || a.ip}:${a.port}` }))}
                                    selected={target.additional}
                                    onChange={(additional) => setTarget({ ...target, additional })}
                                />
                            </div>
                        </>
                    )}
                    <Callout tone={'blue'}>
                        {t('Both nodes must be online and able to reach each other on the Wings port.')}
                    </Callout>
                </div>
            </Drawer>
        </div>
    );
};

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const { data: server, error } = useResource(['admin', 'servers', id], (signal) => getServer(id, signal));
    const base = `/admin/servers/${id}`;

    if (error) return <NotFound />;

    return (
        <Page
            title={server?.name || t('Server')}
            icon={ServerIcon}
            crumbs={[{ label: t('Servers'), to: '/admin/servers' }, { label: server?.identifier || '…' }]}
            description={
                server && (
                    <span className={'inline-flex flex-wrap items-center gap-2'}>
                        <ServerStatusBadge status={server.status} />
                        <span>
                            {t('owned by')}{' '}
                            <Link to={`/admin/users/${server.owner?.id}`}>{server.owner?.username}</Link>{' '}
                            {t('on {{name}}', { name: server.node?.name })}
                        </span>
                    </span>
                )
            }
            guide={'servers'}
            actions={
                server && (
                    <>
                        <Button
                            variant={'secondary'}
                            icon={ClipboardListIcon}
                            to={`/admin/activity?server=${server.id}`}
                        >
                            {t('Activity')}
                        </Button>
                        <Button
                            variant={'secondary'}
                            icon={ClipboardCopyIcon}
                            onClick={() => {
                                copy(server.uuid);
                                toast.info(t('UUID copied'));
                            }}
                        >
                            {t('UUID')}
                        </Button>
                        <Button icon={PlayIcon} to={`/server/${server.identifier}`}>
                            {t('Open as user')}
                        </Button>
                    </>
                )
            }
            tabs={
                <Tabs
                    id={'server'}
                    items={[
                        { to: base, label: t('About'), icon: InformationCircleIcon, end: true },
                        { to: `${base}/build`, label: t('Build'), icon: AdjustmentsIcon },
                        { to: `${base}/startup`, label: t('Startup'), icon: PlayIcon },
                        { to: `${base}/databases`, label: t('Databases'), icon: DatabaseIcon },
                        { to: `${base}/mounts`, label: t('Mounts'), icon: FolderIcon },
                        { to: `${base}/manage`, label: t('Manage'), icon: CogIcon },
                    ]}
                />
            }
        >
            {!server ? (
                <Skeleton className={'h-96 rounded-xl'} />
            ) : (
                <Routes>
                    <Route index element={<About key={server.updated_at} server={server} />} />
                    <Route path={'build'} element={<Build key={server.updated_at} server={server} />} />
                    <Route path={'startup'} element={<Startup key={server.updated_at} server={server} />} />
                    <Route path={'databases'} element={<Databases server={server} />} />
                    <Route path={'mounts'} element={<Mounts server={server} />} />
                    <Route path={'manage'} element={<Manage server={server} />} />
                    <Route path={'*'} element={<Navigate to={base} replace />} />
                </Routes>
            )}
        </Page>
    );
};
