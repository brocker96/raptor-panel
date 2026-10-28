import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeftIcon,
    CloudDownloadIcon,
    CloudUploadIcon,
    CodeIcon,
    DatabaseIcon,
    EyeIcon,
    SearchIcon,
    TableIcon,
    TemplateIcon,
    TrashIcon,
    ViewListIcon,
} from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { queryClient, useResource } from '@/api/query';
import { dropTable, getOverview, truncateTable } from '@/api/server/databases/manager';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { formatBytes } from '@/components/admin/ui/hooks';
import BrowseTab from '@/components/server/databases/manager/BrowseTab';
import StructureTab from '@/components/server/databases/manager/StructureTab';
import SqlConsole from '@/components/server/databases/manager/SqlConsole';
import { ExportModal, ImportModal } from '@/components/server/databases/manager/TransferModals';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

type Tab = 'browse' | 'structure' | 'sql';

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className={'rounded-xl bg-gray-900/60 ring-1 ring-gray-800 px-4 py-3 min-w-0'}>
        <p className={'text-xs text-gray-500'}>{label}</p>
        <p className={'mt-0.5 text-lg font-semibold text-gray-50 truncate'}>{value}</p>
    </div>
);

export default () => {
    const { id: databaseId } = useParams<{ id: string }>();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const [params, setParams] = useSearchParams();
    const [filter, setFilter] = useState('');
    const [dialog, setDialog] = useState<'import' | 'export' | 'truncate' | 'drop' | null>(null);
    const [working, setWorking] = useState(false);

    const table = params.get('table') || undefined;
    const tab = (params.get('tab') as Tab) || (table ? 'browse' : 'sql');

    const { data, error, mutate } = useResource(['server', uuid, 'db-manager', databaseId, 'overview'], () =>
        getOverview(uuid, databaseId!)
    );

    const current = data?.tables.find((item) => item.name === table);
    const visible = useMemo(
        () => (data?.tables || []).filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())),
        [data, filter]
    );

    const open = (name?: string, next?: Tab) => {
        const search = new URLSearchParams();
        if (name) search.set('table', name);
        if (next) search.set('tab', next);
        setParams(search);
    };

    const refresh = () => {
        mutate();
        queryClient.invalidateQueries({ queryKey: ['server', uuid, 'db-manager', databaseId] });
    };

    const destroy = async () => {
        if (!table) return;
        setWorking(true);
        try {
            if (dialog === 'drop') {
                await dropTable(uuid, databaseId!, table);
                toast.success(t('Table {{table}} deleted', { table }));
                open();
            } else {
                await truncateTable(uuid, databaseId!, table);
                toast.success(t('Table {{table}} emptied', { table }));
            }
            setDialog(null);
            refresh();
        } catch (err) {
            toast.fromError(err);
        } finally {
            setWorking(false);
        }
    };

    const tabs: { key: Tab; label: string; icon: React.ComponentType<React.ComponentProps<'svg'>> }[] = [
        { key: 'browse', label: t('Browse'), icon: ViewListIcon },
        { key: 'structure', label: t('Structure'), icon: TemplateIcon },
        { key: 'sql', label: t('SQL'), icon: CodeIcon },
    ];

    return (
        <ServerContentBlock
            title={t('Raptor DB Manager')}
            icon={DatabaseIcon}
            description={
                data ? (
                    <span className={'flex flex-wrap items-center gap-x-2 gap-y-1'}>
                        <span className={'font-mono text-gray-200'}>{data.name}</span>
                        <Badge tone={'gray'}>{data.version}</Badge>
                        <span>{formatBytes(data.size)}</span>
                    </span>
                ) : (
                    t('Browse, edit and query the data of your database right in the panel.')
                )
            }
            actions={
                <>
                    <Button variant={'ghost'} icon={ArrowLeftIcon} to={`/server/${serverId}/databases`}>
                        {t('Databases')}
                    </Button>
                    <Button
                        variant={'secondary'}
                        icon={CloudUploadIcon}
                        disabled={!data}
                        onClick={() => setDialog('import')}
                    >
                        {t('Import')}
                    </Button>
                    <Button
                        variant={'secondary'}
                        icon={CloudDownloadIcon}
                        disabled={!data?.tables.length}
                        onClick={() => setDialog('export')}
                    >
                        {t('Export')}
                    </Button>
                </>
            }
        >
            {error ? (
                <Callout tone={'red'} title={t('The database could not be opened')}>
                    {httpErrorToHuman(error)}
                </Callout>
            ) : !data ? (
                <div className={'grid lg:grid-cols-[16rem_1fr] gap-5'}>
                    <Skeleton className={'h-96 rounded-xl'} />
                    <Skeleton className={'h-96 rounded-xl'} />
                </div>
            ) : (
                <div className={'grid lg:grid-cols-[15rem_minmax(0,1fr)] gap-5 items-start'}>
                    <aside
                        className={
                            'hidden lg:block sticky top-20 rounded-xl ring-1 ring-gray-800 bg-gray-900/40 overflow-hidden'
                        }
                    >
                        <div className={'p-2 border-b border-gray-800'}>
                            <div className={'relative'}>
                                <SearchIcon
                                    className={'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500'}
                                />
                                <input
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder={t('Filter tables')}
                                    className={
                                        'w-full rounded-lg bg-gray-950/60 pl-8 pr-2 py-1.5 text-sm text-gray-100 ring-1 ring-inset ring-gray-800 focus:outline-none focus:ring-raptor-500'
                                    }
                                />
                            </div>
                        </div>
                        <nav className={'max-h-[65vh] overflow-y-auto p-1.5'}>
                            <button
                                type={'button'}
                                onClick={() => open(undefined, 'sql')}
                                className={classNames(
                                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                                    !table ? 'bg-raptor-500/10 text-raptor-300' : 'text-gray-300 hover:bg-white/5'
                                )}
                            >
                                <CodeIcon className={'w-4 h-4'} />
                                {t('SQL console')}
                            </button>
                            <p className={'px-2.5 pt-3 pb-1 text-[0.65rem] uppercase tracking-wider text-gray-600'}>
                                {t('{{count}} tables', { count: data.tables.length })}
                            </p>
                            {visible.map((item) => (
                                <button
                                    key={item.name}
                                    type={'button'}
                                    onClick={() => open(item.name, tab === 'sql' ? 'browse' : tab)}
                                    className={classNames(
                                        'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left',
                                        item.name === table
                                            ? 'bg-raptor-500/10 text-raptor-200'
                                            : 'text-gray-300 hover:bg-white/5'
                                    )}
                                >
                                    {item.view ? (
                                        <EyeIcon className={'w-4 h-4 flex-shrink-0 text-sky-400/80'} />
                                    ) : (
                                        <TableIcon className={'w-4 h-4 flex-shrink-0 text-gray-500'} />
                                    )}
                                    <span
                                        className={'flex-1 min-w-0 truncate font-mono text-[0.8rem]'}
                                        title={item.name}
                                    >
                                        {item.name}
                                    </span>
                                    {item.rows !== null && (
                                        <span className={'text-[0.7rem] text-gray-600 tabular-nums'}>
                                            {item.rows.toLocaleString()}
                                        </span>
                                    )}
                                </button>
                            ))}
                            {!visible.length && (
                                <p className={'px-2.5 py-3 text-xs text-gray-600'}>{t('No tables found')}</p>
                            )}
                        </nav>
                    </aside>

                    <section className={'min-w-0 space-y-4'}>
                        <div className={'lg:hidden'}>
                            <select
                                value={table || ''}
                                onChange={(e) => open(e.target.value || undefined, e.target.value ? 'browse' : 'sql')}
                                className={
                                    'w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-mono text-gray-100 ring-1 ring-inset ring-gray-700'
                                }
                                aria-label={t('Table')}
                            >
                                <option value={''}>{t('SQL console')}</option>
                                {data.tables.map((item) => (
                                    <option key={item.name} value={item.name}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {table && current ? (
                            <>
                                <div className={'flex flex-wrap items-center gap-3'}>
                                    <div className={'min-w-0 flex-1'}>
                                        <h2
                                            className={
                                                'flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-50'
                                            }
                                        >
                                            <span className={'font-mono break-all'}>{current.name}</span>
                                            {current.view && <Badge tone={'blue'}>{t('View')}</Badge>}
                                        </h2>
                                        <p className={'text-xs text-gray-500'}>
                                            {[
                                                current.engine,
                                                current.rows !== null &&
                                                    t('≈ {{rows}} rows', { rows: current.rows.toLocaleString() }),
                                                formatBytes(current.size),
                                                current.collation,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    {!current.view && (
                                        <Button variant={'ghost'} size={'sm'} onClick={() => setDialog('truncate')}>
                                            {t('Empty')}
                                        </Button>
                                    )}
                                    <Button
                                        variant={'danger'}
                                        size={'sm'}
                                        icon={TrashIcon}
                                        onClick={() => setDialog('drop')}
                                    >
                                        {t('Delete')}
                                    </Button>
                                </div>
                                <div className={'flex gap-1 border-b border-gray-800 overflow-x-auto'}>
                                    {tabs.map((item) => (
                                        <button
                                            key={item.key}
                                            type={'button'}
                                            onClick={() => open(table, item.key)}
                                            className={classNames(
                                                'flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 whitespace-nowrap transition-colors',
                                                tab === item.key
                                                    ? 'border-raptor-500 text-gray-50'
                                                    : 'border-transparent text-gray-400 hover:text-gray-200'
                                            )}
                                        >
                                            <item.icon className={'w-4 h-4'} />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                {tab === 'browse' && (
                                    <BrowseTab uuid={uuid} database={databaseId!} table={table} view={current.view} />
                                )}
                                {tab === 'structure' && (
                                    <StructureTab uuid={uuid} database={databaseId!} table={table} />
                                )}
                                {tab === 'sql' && (
                                    <SqlConsole
                                        key={table}
                                        uuid={uuid}
                                        database={databaseId!}
                                        table={table}
                                        onChanged={refresh}
                                    />
                                )}
                            </>
                        ) : table ? (
                            <EmptyState
                                icon={TableIcon}
                                title={t('This table does not exist anymore')}
                                action={<Button onClick={() => open()}>{t('Back')}</Button>}
                            />
                        ) : (
                            <>
                                <div className={'grid grid-cols-2 xl:grid-cols-4 gap-3'}>
                                    <Stat label={t('Tables')} value={data.tables.length} />
                                    <Stat
                                        label={t('Rows (approx.)')}
                                        value={data.tables
                                            .reduce((sum, item) => sum + (item.rows || 0), 0)
                                            .toLocaleString()}
                                    />
                                    <Stat label={t('Size')} value={formatBytes(data.size)} />
                                    <Stat
                                        label={t('Charset')}
                                        value={<span className={'font-mono text-base'}>{data.charset}</span>}
                                    />
                                </div>
                                {!data.tables.length && (
                                    <Callout tone={'blue'} title={t('This database is empty')}>
                                        {t('Create a table with the SQL console below, or import a .sql file.')}
                                    </Callout>
                                )}
                                <SqlConsole uuid={uuid} database={databaseId!} onChanged={refresh} />
                            </>
                        )}
                    </section>
                </div>
            )}

            {data && (
                <>
                    <ExportModal
                        open={dialog === 'export'}
                        onClose={() => setDialog(null)}
                        uuid={uuid}
                        database={databaseId!}
                        tables={data.tables}
                    />
                    <ImportModal
                        open={dialog === 'import'}
                        onClose={() => setDialog(null)}
                        uuid={uuid}
                        database={databaseId!}
                        onImported={refresh}
                    />
                </>
            )}
            <Confirm
                open={dialog === 'drop' || dialog === 'truncate'}
                title={
                    dialog === 'drop' ? t('Delete table {{table}}?', { table }) : t('Empty table {{table}}?', { table })
                }
                confirm={dialog === 'drop' ? t('Delete table') : t('Empty table')}
                challenge={table}
                loading={working}
                onConfirm={destroy}
                onClose={() => setDialog(null)}
            >
                {dialog === 'drop'
                    ? t(
                          'The table and all of its rows are deleted permanently. Export it first if you might need it again.'
                      )
                    : t('Every row of the table is deleted permanently, the structure stays.')}
            </Confirm>
        </ServerContentBlock>
    );
};
