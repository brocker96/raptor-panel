import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import classNames from 'classnames';
import {
    ChipIcon,
    ClipboardCopyIcon,
    CodeIcon,
    CogIcon,
    InformationCircleIcon,
    LightningBoltIcon,
    PlusIcon,
    ServerIcon,
    StatusOfflineIcon,
    SwitchHorizontalIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    AdminNode,
    createAllocations,
    deleteAllocations,
    deleteNode,
    getNode,
    getNodeAllocations,
    getNodeConfiguration,
    NodeAllocation,
    NodeValues,
    updateAllocationAlias,
    updateNode,
} from '@/api/admin';
import { Page, Segmented, Tabs } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import { Badge, Callout, EmptyState, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { Column, DataTable, Pagination, SearchInput, Toolbar } from '@/components/admin/ui/DataTable';
import { TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { toast } from '@/components/admin/ui/Toast';
import { formatMb, useAction, useListParams } from '@/components/admin/ui/hooks';
import NodeForm from '@/components/admin/nodes/NodeForm';
import NodeStatus, { useNodeStatus } from '@/components/admin/nodes/NodeStatus';
import ServerTable from '@/components/admin/servers/ServerTable';
import { NotFound } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

const About = ({ node }: { node: AdminNode }) => {
    const { data: status } = useNodeStatus(node.id);
    const memoryMax = node.memory * (1 + Math.max(0, node.memory_overallocate) / 100);
    const diskMax = node.disk * (1 + Math.max(0, node.disk_overallocate) / 100);

    return (
        <div className={'grid gap-6 lg:grid-cols-3'}>
            <div className={'lg:col-span-2 space-y-6'}>
                {status && !status.online && (
                    <Callout
                        tone={'red'}
                        icon={StatusOfflineIcon}
                        title={t('The Panel cannot reach Wings on this node')}
                    >
                        <code className={'block mt-1 text-xs break-all'}>{status.error}</code>
                        <span className={'block mt-2'}>
                            {t('Check that Wings is running (')}
                            <code>systemctl status wings</code>
                            {t('), the port {{daemon_listen}} is open and the configuration is up to date.', {
                                daemon_listen: node.daemon_listen,
                            })}
                        </span>
                    </Callout>
                )}
                <Card
                    title={t('Allocated resources')}
                    description={t('Sum of the limits of all servers on this node.')}
                >
                    <div className={'grid gap-6 sm:grid-cols-2'}>
                        {[
                            [t('Memory'), node.usage.memory, memoryMax, node.memory],
                            [t('Disk'), node.usage.disk, diskMax, node.disk],
                        ].map(([label, used, max, base]) => (
                            <div key={label as string}>
                                <div className={'flex items-baseline justify-between'}>
                                    <p className={'text-sm font-medium text-gray-200'}>{label}</p>
                                    <p className={'text-xs text-gray-500 tabular-nums'}>
                                        {Math.round(((used as number) / (max as number)) * 100) || 0}%
                                    </p>
                                </div>
                                <p className={'mt-1 text-xl font-semibold text-gray-50 tabular-nums'}>
                                    {formatMb(used as number)}{' '}
                                    <span className={'text-xs font-normal text-gray-500'}>
                                        {t('of {{formatMb}}', { formatMb: formatMb(max as number) })}
                                    </span>
                                </p>
                                <Meter value={used as number} max={max as number} className={'mt-2'} />
                                {max !== base && (
                                    <p className={'mt-1 text-2xs text-gray-600'}>
                                        {t('Includes overallocation of the {{formatMb}} budget', {
                                            formatMb: formatMb(base as number),
                                        })}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
                <Card title={t('Details')}>
                    <Details
                        items={[
                            [
                                t('Address'),
                                <code key={'a'}>{`${node.scheme}://${node.fqdn}:${node.daemon_listen}`}</code>,
                            ],
                            [t('SFTP'), <code key={'s'}>{`${node.fqdn}:${node.daemon_sftp}`}</code>],
                            [
                                t('Location'),
                                node.location
                                    ? `${node.location.short}${node.location.long ? ` — ${node.location.long}` : ''}`
                                    : null,
                            ],
                            [t('Data directory'), <code key={'d'}>{node.daemon_base}</code>],
                            [
                                t('Allocations'),
                                node.allocations
                                    ? t('{{assigned}} of {{total}} assigned', {
                                          assigned: node.allocations.assigned,
                                          total: node.allocations.total,
                                      })
                                    : null,
                            ],
                            [t('Upload limit'), t('{{upload_size}} MiB', { upload_size: node.upload_size })],
                            [t('Behind proxy'), node.behind_proxy ? t('Yes') : t('No')],
                            [
                                t('UUID'),
                                <code key={'u'} className={'text-xs break-all'}>
                                    {node.uuid}
                                </code>,
                            ],
                        ]}
                    />
                </Card>
            </div>
            <Card title={t('Wings')} icon={ChipIcon} actions={<NodeStatus id={node.id} />}>
                {!status ? (
                    <Skeleton className={'h-32'} />
                ) : status.online && status.system ? (
                    <Details
                        items={[
                            [t('Version'), status.version],
                            [t('System'), `${status.system.type} (${status.system.arch})`],
                            [t('Kernel'), status.system.release],
                            [t('CPU threads'), status.system.cpus],
                            [t('Response time'), t('{{latency}} ms', { latency: status.latency })],
                        ]}
                    />
                ) : (
                    <p className={'text-sm text-gray-400'}>
                        {t('Wings is not reachable. System information is shown once it comes online.')}
                    </p>
                )}
            </Card>
        </div>
    );
};

const Settings = ({ node }: { node: AdminNode }) => {
    const navigate = useNavigate();
    const [values, setValues] = useState<NodeValues>(() => ({
        name: node.name,
        description: node.description || '',
        location_id: node.location?.id || 0,
        public: node.public,
        fqdn: node.fqdn,
        scheme: node.scheme,
        behind_proxy: node.behind_proxy,
        maintenance_mode: node.maintenance_mode,
        memory: node.memory,
        memory_overallocate: node.memory_overallocate,
        disk: node.disk,
        disk_overallocate: node.disk_overallocate,
        upload_size: node.upload_size,
        daemonListen: node.daemon_listen,
        daemonSFTP: node.daemon_sftp,
        daemonBase: node.daemon_base,
    }));
    const [resetToken, setResetToken] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const save = useAction(() => updateNode(node.id, { ...values, reset_secret: resetToken }), {
        success: resetToken ? t('Node saved, update config.yml on the node with the new token') : t('Node saved'),
        invalidate: [['admin', 'nodes']],
        onSuccess: () => setResetToken(false),
    });
    const remove = useAction(() => deleteNode(node.id), {
        success: t('Node deleted'),
        invalidate: [['admin', 'nodes']],
        onSuccess: () => navigate('/admin/nodes'),
    });

    return (
        <div className={'space-y-6'}>
            <NodeForm values={values} onChange={setValues} errors={save.errors} editing />
            <Card title={t('Daemon token')}>
                <Toggle
                    label={t('Reset the daemon token when saving')}
                    description={t(
                        'Generates new credentials for Wings. The node stays offline until config.yml on it is updated and Wings restarted.'
                    )}
                    checked={resetToken}
                    onChange={setResetToken}
                />
            </Card>
            <div className={'flex flex-col-reverse sm:flex-row sm:justify-between gap-2'}>
                <Button
                    variant={'danger'}
                    icon={TrashIcon}
                    disabled={node.usage.servers > 0}
                    onClick={() => setDeleting(true)}
                >
                    {node.usage.servers > 0 ? t('Remove all servers to delete') : t('Delete node')}
                </Button>
                <Button loading={save.loading} onClick={() => save.run()}>
                    {t('Save changes')}
                </Button>
            </div>
            <Confirm
                open={deleting}
                title={t('Delete {{name}}?', { name: node.name })}
                challenge={node.name}
                confirm={t('Delete node')}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setDeleting(false)}
            >
                {t(
                    'The node and all of its allocations are removed from the Panel. Wings on the machine keeps running until you uninstall it.'
                )}
            </Confirm>
        </div>
    );
};

const Configuration = ({ node }: { node: AdminNode }) => {
    const [deploy, setDeploy] = useState(false);
    const { data } = useResource(['admin', 'nodes', node.id, 'configuration', deploy], (signal) =>
        getNodeConfiguration(node.id, deploy, signal)
    );

    const copyText = (text: string, what: string) => {
        copy(text);
        toast.success(t('{{what}} copied', { what: what }));
    };

    return (
        <div className={'grid gap-6 lg:grid-cols-5'}>
            <Card
                title={'config.yml'}
                icon={CodeIcon}
                description={t('Place this file at /etc/pterodactyl/config.yml on the node, then restart Wings.')}
                className={'lg:col-span-3'}
                actions={
                    <Button
                        size={'sm'}
                        variant={'secondary'}
                        icon={ClipboardCopyIcon}
                        disabled={!data}
                        onClick={() => copyText(data!.yaml, 'Configuration')}
                    >
                        {t('Copy')}
                    </Button>
                }
            >
                {data ? (
                    <pre
                        className={
                            'max-h-[32rem] overflow-auto rounded-lg bg-black/60 p-4 text-xs leading-relaxed text-gray-200 font-mono ring-1 ring-inset ring-gray-800'
                        }
                    >
                        {data.yaml}
                    </pre>
                ) : (
                    <Skeleton className={'h-96'} />
                )}
            </Card>
            <div className={'lg:col-span-2 space-y-6'}>
                <Card
                    title={t('Auto deploy')}
                    icon={LightningBoltIcon}
                    description={t('Set up the node with a single command.')}
                >
                    {data?.install_command ? (
                        <div className={'space-y-3'}>
                            <p className={'text-xs font-medium text-gray-300'}>{t('New server: install Raptor Wings')}</p>
                            <pre
                                className={
                                    'rounded-lg bg-black/60 p-3 text-xs text-gray-200 font-mono whitespace-pre-wrap break-all ring-1 ring-inset ring-raptor-500/30'
                                }
                            >
                                {data.install_command}
                            </pre>
                            <Button
                                className={'w-full'}
                                icon={ClipboardCopyIcon}
                                onClick={() => copyText(data.install_command!, 'Command')}
                            >
                                {t('Copy install command')}
                            </Button>
                            <p className={'text-xs text-gray-500'}>
                                {t('Run it as root on a clean Ubuntu or Debian server. It installs Docker, Wings, an HTTPS certificate and the firewall, then connects the node to this Panel.')}
                            </p>
                            <p className={'pt-2 text-xs font-medium text-gray-300'}>{t('Wings already installed')}</p>
                        </div>
                    ) : null}
                    {data?.deploy_command ? (
                        <div className={'space-y-3'}>
                            <pre
                                className={
                                    'rounded-lg bg-black/60 p-3 text-xs text-gray-200 font-mono whitespace-pre-wrap break-all ring-1 ring-inset ring-gray-800'
                                }
                            >
                                {data.deploy_command}
                            </pre>
                            <Button
                                className={'w-full'}
                                variant={'secondary'}
                                icon={ClipboardCopyIcon}
                                onClick={() => copyText(data.deploy_command!, 'Command')}
                            >
                                {t('Copy command')}
                            </Button>
                            <p className={'text-xs text-gray-500'}>
                                {t('Uses a read-only application key that can only view node configurations.')}
                            </p>
                        </div>
                    ) : (
                        <Button className={'w-full'} icon={LightningBoltIcon} onClick={() => setDeploy(true)}>
                            {t('Auto-deploy command')}
                        </Button>
                    )}
                </Card>
                <Card title={t('Next steps')}>
                    <ol className={'space-y-2 text-sm text-gray-400'}>
                        {[
                            t('Install Docker and Wings on the machine.'),
                            t('Save the configuration as /etc/pterodactyl/config.yml.'),
                            t('Run "wings --debug" once to check for errors.'),
                            t('Enable the service: systemctl enable --now wings'),
                            t('Add allocations so servers can be created.'),
                        ].map((step, i) => (
                            <li key={i} className={'flex gap-3'}>
                                <span
                                    className={
                                        'grid place-items-center flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 text-2xs text-gray-300'
                                    }
                                >
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ol>
                    <Button variant={'ghost'} size={'sm'} className={'mt-3'} to={'/admin/guides/node-configuration'}>
                        {t('Full installation guide →')}
                    </Button>
                </Card>
            </div>
        </div>
    );
};

const AliasCell = ({ node, allocation }: { node: number; allocation: NodeAllocation }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(allocation.alias || '');
    const save = useAction(() => updateAllocationAlias(node, allocation.id, value || null), {
        invalidate: [['admin', 'nodes', node, 'allocations']],
        onSuccess: () => setEditing(false),
    });

    if (!editing) {
        return (
            <button
                type={'button'}
                onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                }}
                className={classNames(
                    'text-left text-sm hover:text-white',
                    allocation.alias ? 'text-gray-300' : 'text-gray-600'
                )}
            >
                {allocation.alias || t('Add alias')}
            </button>
        );
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                save.run();
            }}
            onClick={(e) => e.stopPropagation()}
            className={'flex gap-1'}
        >
            <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => save.run()}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                className={
                    'h-8 w-44 px-2 rounded-md bg-gray-950/60 border-0 ring-1 ring-inset ring-raptor-500 text-sm text-gray-100 focus:outline-none'
                }
            />
        </form>
    );
};

const Allocations = ({ node }: { node: AdminNode }) => {
    const list = useListParams(['filter']);
    const key = ['admin', 'nodes', node.id, 'allocations', list.query];
    const { data, isValidating } = useResource(key, (signal) => getNodeAllocations(node.id, list.query, signal), {
        keepPrevious: true,
    });
    const [selected, setSelected] = useState<Set<string | number>>(new Set());
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ ip: '', alias: '', ports: '' });
    const [confirm, setConfirm] = useState<{ ids: number[] } | { ip: string } | null>(null);

    useEffect(() => setSelected(new Set()), [list.page, list.search, list.filters.filter]);

    const create = useAction(
        () =>
            createAllocations(node.id, {
                ip: form.ip,
                alias: form.alias,
                ports: form.ports.split(/[\s,]+/).filter(Boolean),
            }),
        {
            success: t('Allocations created'),
            invalidate: [['admin', 'nodes']],
            onSuccess: () => {
                setAdding(false);
                setForm({ ...form, ports: '' });
            },
        }
    );
    const remove = useAction((target: { ids: number[] } | { ip: string }) => deleteAllocations(node.id, target), {
        success: (r) =>
            r.skipped
                ? t('Allocations deleted: {{deleted}}, assigned ones kept: {{skipped}}', {
                      deleted: r.deleted,
                      skipped: r.skipped,
                  })
                : t('Allocations deleted: {{deleted}}', { deleted: r.deleted }),
        invalidate: [['admin', 'nodes']],
        onSuccess: () => {
            setConfirm(null);
            setSelected(new Set());
        },
    });

    const columns: Column<NodeAllocation>[] = [
        { key: 'ip', header: t('IP address'), cell: (a) => <code className={'text-sm text-gray-200'}>{a.ip}</code> },
        { key: 'alias', header: t('Alias'), cell: (a) => <AliasCell node={node.id} allocation={a} />, hideBelow: 'md' },
        {
            key: 'port',
            header: t('Port'),
            cell: (a) => <span className={'font-mono tabular-nums text-gray-100'}>{a.port}</span>,
        },
        {
            key: 'server',
            header: t('Assigned to'),
            cell: (a) =>
                a.server ? (
                    <Badge tone={'green'}>{a.server.name}</Badge>
                ) : (
                    <span className={'text-gray-600'}>{t('Free')}</span>
                ),
        },
    ];

    return (
        <div className={'space-y-6'}>
            <Card flush>
                <Toolbar>
                    <SearchInput
                        value={list.search}
                        onChange={list.setSearch}
                        placeholder={t('Search IP, alias, port or notes…')}
                        className={'flex-1'}
                    />
                    <Segmented
                        id={'alloc-filter'}
                        value={list.filters.filter || 'all'}
                        onChange={(value) => list.setFilter('filter', value === 'all' ? '' : value)}
                        options={[
                            { value: 'all', label: t('All') },
                            { value: 'unassigned', label: t('Free') },
                            { value: 'assigned', label: t('Assigned') },
                        ]}
                    />
                    <Button icon={PlusIcon} onClick={() => setAdding(true)}>
                        {t('Add')}
                    </Button>
                </Toolbar>
                {selected.size > 0 && (
                    <div
                        className={
                            'flex items-center gap-3 mx-4 sm:mx-5 mb-3 px-3 py-2 rounded-lg bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/25 text-sm'
                        }
                    >
                        <span className={'flex-1 text-raptor-100'}>
                            {t('{{size}} selected', { size: selected.size })}
                        </span>
                        <Button
                            size={'sm'}
                            variant={'danger'}
                            icon={TrashIcon}
                            onClick={() => setConfirm({ ids: [...selected].map(Number) })}
                        >
                            {t('Delete selected')}
                        </Button>
                    </div>
                )}
                <DataTable
                    rows={data?.data}
                    loading={isValidating}
                    columns={columns}
                    rowKey={(a) => a.id}
                    selected={selected}
                    onSelect={setSelected}
                    mobile={(a) => (
                        <div className={'flex items-center gap-3'}>
                            <code className={'flex-1 text-sm text-gray-100'}>
                                {a.alias || a.ip}:{a.port}
                            </code>
                            {a.server ? <Badge tone={'green'}>{a.server.name}</Badge> : <Badge>{t('Free')}</Badge>}
                        </div>
                    )}
                    empty={
                        <EmptyState
                            icon={SwitchHorizontalIcon}
                            title={t('No allocations')}
                            description={t('Servers need at least one IP and port. Add a port range to get started.')}
                            action={
                                <Button icon={PlusIcon} onClick={() => setAdding(true)}>
                                    {t('Add allocations')}
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
            {data && data.ips.length > 0 && (
                <Card
                    title={t('Clean up')}
                    description={t('Delete every free allocation of an IP address. Assigned allocations are kept.')}
                >
                    <div className={'flex flex-wrap gap-2'}>
                        {data.ips.map((ip) => (
                            <Button
                                key={ip}
                                size={'sm'}
                                variant={'secondary'}
                                icon={TrashIcon}
                                onClick={() => setConfirm({ ip })}
                            >
                                {ip}
                            </Button>
                        ))}
                    </div>
                </Card>
            )}
            <Drawer
                open={adding}
                onClose={() => setAdding(false)}
                icon={SwitchHorizontalIcon}
                title={t('Add allocations')}
                description={t('Ports must also be opened in the firewall of the node.')}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setAdding(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run()}>
                            {t('Create')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={t('IP address')}
                        required
                        value={form.ip}
                        onChange={(ip) => setForm({ ...form, ip })}
                        error={create.errors.allocation_ip}
                        placeholder={'203.0.113.10'}
                        description={t('Public IP, 0.0.0.0 for every address, or a CIDR range (/25 – /32).')}
                    />
                    {data && data.ips.length > 0 && (
                        <div className={'flex flex-wrap gap-1.5 -mt-2'}>
                            {data.ips.map((ip) => (
                                <button
                                    key={ip}
                                    type={'button'}
                                    onClick={() => setForm({ ...form, ip })}
                                    className={
                                        'h-6 px-2 rounded-full bg-gray-800 text-xs text-gray-300 hover:text-white'
                                    }
                                >
                                    {ip}
                                </button>
                            ))}
                        </div>
                    )}
                    <TextInput
                        label={t('Alias')}
                        value={form.alias}
                        onChange={(alias) => setForm({ ...form, alias })}
                        placeholder={'play.example.com'}
                        description={t('Shown to users instead of the IP address.')}
                    />
                    <TextArea
                        label={t('Ports')}
                        required
                        mono
                        rows={3}
                        value={form.ports}
                        onChange={(ports) => setForm({ ...form, ports })}
                        error={create.errors.allocation_ports || create.errors['allocation_ports.0']}
                        placeholder={'25565-25600\n27015'}
                        description={t(
                            'Single ports or ranges, separated by commas or new lines. Up to 1000 ports per range, above 1024.'
                        )}
                    />
                </div>
            </Drawer>
            <Confirm
                open={!!confirm}
                title={
                    confirm && 'ip' in confirm
                        ? t('Delete free allocations of {{ip}}?', { ip: confirm.ip })
                        : t('Delete {{size}} allocations?', { size: selected.size })
                }
                confirm={t('Delete')}
                loading={remove.loading}
                onConfirm={() => confirm && remove.run(confirm)}
                onClose={() => setConfirm(null)}
            >
                {t('Allocations assigned to a server are never deleted.')}
            </Confirm>
        </div>
    );
};

const Servers = ({ node }: { node: AdminNode }) => {
    const [page, setPage] = useState(1);

    return (
        <Card flush>
            <ServerTable params={{ node: node.id }} page={page} onPage={setPage} />
        </Card>
    );
};

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const { data: node, error } = useResource(['admin', 'nodes', id], (signal) => getNode(id, signal));
    const base = `/admin/nodes/${id}`;

    if (error) return <NotFound />;

    return (
        <Page
            title={node?.name || t('Node')}
            icon={ChipIcon}
            crumbs={[{ label: t('Nodes'), to: '/admin/nodes' }, { label: node?.name || '…' }]}
            description={node ? <code className={'text-xs'}>{node.fqdn}</code> : undefined}
            guide={'nodes'}
            actions={node && <NodeStatus id={node.id} />}
            tabs={
                <Tabs
                    id={'node'}
                    items={[
                        { to: base, label: t('About'), icon: InformationCircleIcon, end: true },
                        { to: `${base}/settings`, label: t('Settings'), icon: CogIcon },
                        { to: `${base}/configuration`, label: t('Configuration'), icon: CodeIcon },
                        { to: `${base}/allocations`, label: t('Allocations'), icon: SwitchHorizontalIcon },
                        { to: `${base}/servers`, label: t('Servers'), icon: ServerIcon },
                    ]}
                />
            }
        >
            {!node ? (
                <Skeleton className={'h-96 rounded-xl'} />
            ) : (
                <Routes>
                    <Route index element={<About node={node} />} />
                    <Route path={'settings'} element={<Settings key={node.id} node={node} />} />
                    <Route path={'configuration'} element={<Configuration node={node} />} />
                    <Route path={'allocations'} element={<Allocations node={node} />} />
                    <Route path={'servers'} element={<Servers node={node} />} />
                    <Route path={'*'} element={<Navigate to={base} replace />} />
                </Routes>
            )}
        </Page>
    );
};
