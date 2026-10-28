import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    DownloadIcon,
    FilterIcon,
    KeyIcon,
    PlusIcon,
    RefreshIcon,
    SearchIcon,
    TrashIcon,
    XIcon,
} from '@heroicons/react/outline';
import { CheckIcon } from '@heroicons/react/solid';
import { useResource } from '@/api/query';
import { DbFilter, DbRowsQuery, DbValue, deleteRows, getRows } from '@/api/server/databases/manager';
import Button from '@/components/admin/ui/Button';
import { Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import RowEditor from '@/components/server/databases/manager/RowEditor';
import { Cell, downloadText, rowKey, toCsv, valueText } from '@/components/server/databases/manager/values';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

interface Props {
    uuid: string;
    database: string;
    table: string;
    view: boolean;
}

const OPERATORS: { value: DbFilter['operator']; label: string }[] = [
    { value: '=', label: '=' },
    { value: '!=', label: '≠' },
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '≥' },
    { value: '<=', label: '≤' },
    { value: 'like', label: 'LIKE' },
    { value: 'null', label: 'IS NULL' },
    { value: 'not_null', label: 'IS NOT NULL' },
];

const control =
    'rounded-lg bg-gray-950/60 px-2.5 py-1.5 text-sm text-gray-100 ring-1 ring-inset ring-gray-700 focus:outline-none focus:ring-2 focus:ring-raptor-500';

const Box = ({ state, onClick, label }: { state: 'on' | 'off' | 'some'; onClick: () => void; label: string }) => (
    <button
        type={'button'}
        aria-label={label}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className={classNames(
            'grid place-items-center w-4 h-4 rounded ring-1 ring-inset transition-colors',
            state === 'off' ? 'ring-gray-600 hover:ring-gray-400' : 'bg-raptor-500 ring-raptor-400 text-gray-950'
        )}
    >
        {state === 'on' && <CheckIcon className={'w-3 h-3'} />}
        {state === 'some' && <span className={'w-2 h-0.5 rounded bg-gray-950'} />}
    </button>
);

const BrowseTab = ({ uuid, database, table, view }: Props) => {
    const [query, setQuery] = useState<DbRowsQuery>({ page: 1, per_page: 50 });
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<DbFilter[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [editing, setEditing] = useState<{ row?: number; focus?: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setQuery({ page: 1, per_page: 50 });
        setSearch('');
        setFilters([]);
        setShowFilters(false);
    }, [table]);

    useEffect(() => setSelected([]), [query, table]);

    // Searching waits for a short pause in typing before hitting the database.
    useEffect(() => {
        const timeout = setTimeout(() => setQuery((q) => (q.search === search ? q : { ...q, search, page: 1 })), 350);

        return () => clearTimeout(timeout);
    }, [search]);

    const { data, error, isValidating, mutate } = useResource(
        ['server', uuid, 'db-manager', database, 'rows', table, query],
        () => getRows(uuid, database, table, query),
        { keepPrevious: true, refetchOnWindowFocus: false, staleTime: 0 }
    );

    const truncated = useMemo(() => {
        const map = new Map<number, number[]>();
        data?.truncated.forEach(([row, cell]) => map.set(row, [...(map.get(row) || []), cell]));

        return map;
    }, [data]);

    const sort = (column: string) =>
        setQuery((q) => {
            if (q.sort !== column) return { ...q, sort: column, direction: 'asc', page: 1 };
            if (q.direction === 'asc') return { ...q, direction: 'desc', page: 1 };

            return { ...q, sort: undefined, direction: undefined, page: 1 };
        });

    const applyFilters = () => {
        const valid = filters.filter(
            (f) => f.column && (f.operator === 'null' || f.operator === 'not_null' || f.value !== '')
        );
        setQuery((q) => ({ ...q, filters: valid, page: 1 }));
    };

    const remove = async () => {
        if (!data) return;
        setDeleting(true);
        try {
            const keys = selected.map((i) => rowKey(data.columns, data.primary, data.rows[i]));
            const { deleted } = await deleteRows(uuid, database, table, keys);
            toast.success(t('{{count}} rows deleted', { count: deleted }));
            setConfirmDelete(false);
            mutate();
        } catch (err) {
            toast.fromError(err);
        } finally {
            setDeleting(false);
        }
    };

    if (error) {
        return <Callout tone={'red'}>{httpErrorToHuman(error)}</Callout>;
    }

    const rows = data?.rows || [];
    const columns = data?.columns || [];
    const pages = data?.pagination;
    const allState = !rows.length || !selected.length ? 'off' : selected.length === rows.length ? 'on' : 'some';
    const activeFilters = (query.filters || []).length;

    return (
        <div className={'space-y-3'}>
            <div className={'flex flex-wrap items-center gap-2'}>
                <div className={'relative flex-1 min-w-[12rem]'}>
                    <SearchIcon
                        className={
                            'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none'
                        }
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('Search in every column…')}
                        className={classNames(control, 'w-full pl-8')}
                    />
                </div>
                <Button
                    variant={activeFilters ? 'primary' : 'secondary'}
                    size={'sm'}
                    icon={FilterIcon}
                    onClick={() => {
                        setShowFilters((v) => !v);
                        if (!filters.length && columns.length)
                            setFilters([{ column: columns[0].name, operator: '=', value: '' }]);
                    }}
                >
                    {activeFilters ? t('Filters · {{count}}', { count: activeFilters }) : t('Filter')}
                </Button>
                <Button
                    variant={'ghost'}
                    size={'sm'}
                    icon={RefreshIcon}
                    aria-label={t('Reload')}
                    title={t('Reload')}
                    onClick={() => mutate()}
                    className={isValidating ? '[&_svg]:animate-spin' : undefined}
                />
                <Button
                    variant={'ghost'}
                    size={'sm'}
                    icon={DownloadIcon}
                    title={t('Download this page as CSV')}
                    aria-label={t('Download this page as CSV')}
                    disabled={!rows.length}
                    onClick={() =>
                        downloadText(
                            `${table}.csv`,
                            toCsv(
                                columns.map((c) => c.name),
                                rows
                            )
                        )
                    }
                />
                {!view && (
                    <Button size={'sm'} icon={PlusIcon} onClick={() => setEditing({})} disabled={!columns.length}>
                        {t('Insert')}
                    </Button>
                )}
            </div>

            {showFilters && (
                <div className={'rounded-xl bg-gray-900/60 ring-1 ring-gray-800 p-3 space-y-2'}>
                    {filters.map((filter, i) => (
                        <div key={i} className={'flex flex-wrap items-center gap-2'}>
                            <select
                                value={filter.column}
                                onChange={(e) =>
                                    setFilters((f) => f.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))
                                }
                                className={classNames(control, 'font-mono min-w-0 flex-1 sm:flex-none sm:w-48')}
                            >
                                {columns.map((c) => (
                                    <option key={c.name} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filter.operator}
                                onChange={(e) =>
                                    setFilters((f) =>
                                        f.map((x, j) =>
                                            j === i ? { ...x, operator: e.target.value as DbFilter['operator'] } : x
                                        )
                                    )
                                }
                                className={classNames(control, 'w-32')}
                            >
                                {OPERATORS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            {filter.operator !== 'null' && filter.operator !== 'not_null' && (
                                <input
                                    value={filter.value || ''}
                                    onChange={(e) =>
                                        setFilters((f) =>
                                            f.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))
                                        )
                                    }
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                    placeholder={filter.operator === 'like' ? '%text%' : t('Value')}
                                    className={classNames(control, 'flex-1 min-w-[8rem]')}
                                />
                            )}
                            <button
                                type={'button'}
                                aria-label={t('Remove')}
                                onClick={() => setFilters((f) => f.filter((_, j) => j !== i))}
                                className={'p-1.5 rounded-lg text-gray-500 hover:text-gray-100 hover:bg-white/5'}
                            >
                                <XIcon className={'w-4 h-4'} />
                            </button>
                        </div>
                    ))}
                    <div className={'flex flex-wrap gap-2 pt-1'}>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={PlusIcon}
                            onClick={() =>
                                setFilters((f) => [...f, { column: columns[0]?.name || '', operator: '=', value: '' }])
                            }
                        >
                            {t('Add condition')}
                        </Button>
                        <span className={'flex-1'} />
                        {activeFilters > 0 && (
                            <Button
                                variant={'ghost'}
                                size={'sm'}
                                onClick={() => {
                                    setFilters([]);
                                    setQuery((q) => ({ ...q, filters: [], page: 1 }));
                                }}
                            >
                                {t('Clear')}
                            </Button>
                        )}
                        <Button size={'sm'} onClick={applyFilters}>
                            {t('Apply')}
                        </Button>
                    </div>
                </div>
            )}

            {selected.length > 0 && !view && (
                <div
                    className={
                        'flex flex-wrap items-center gap-3 rounded-xl bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/20 px-3 py-2'
                    }
                >
                    <span className={'text-sm text-raptor-200'}>
                        {t('{{count}} rows selected', { count: selected.length })}
                    </span>
                    <span className={'flex-1'} />
                    <Button variant={'ghost'} size={'sm'} onClick={() => setSelected([])}>
                        {t('Clear selection')}
                    </Button>
                    <Button variant={'danger'} size={'sm'} icon={TrashIcon} onClick={() => setConfirmDelete(true)}>
                        {t('Delete')}
                    </Button>
                </div>
            )}

            {!data ? (
                <Skeleton className={'h-80 rounded-xl'} />
            ) : !rows.length ? (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={search || activeFilters ? SearchIcon : PlusIcon}
                        title={search || activeFilters ? t('No rows match') : t('This table is empty')}
                        description={
                            search || activeFilters
                                ? t('Try another search or remove some filters.')
                                : t('Insert the first row to get started.')
                        }
                        action={
                            !view && !search && !activeFilters ? (
                                <Button icon={PlusIcon} onClick={() => setEditing({})}>
                                    {t('Insert row')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            ) : (
                <div
                    className={classNames(
                        'relative rounded-xl ring-1 ring-gray-800 bg-gray-900/40 overflow-auto max-h-[65vh] transition-opacity',
                        isValidating && 'opacity-70'
                    )}
                >
                    <table className={'min-w-full text-sm border-separate border-spacing-0'}>
                        <thead>
                            <tr>
                                {!view && (
                                    <th
                                        className={
                                            'sticky top-0 left-0 z-20 w-10 px-3 py-2.5 bg-gray-900 border-b border-gray-800'
                                        }
                                    >
                                        <Box
                                            state={allState}
                                            label={t('Select all')}
                                            onClick={() => setSelected(allState === 'on' ? [] : rows.map((_, i) => i))}
                                        />
                                    </th>
                                )}
                                {columns.map((column) => (
                                    <th
                                        key={column.name}
                                        className={
                                            'sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-0 text-left font-medium whitespace-nowrap'
                                        }
                                    >
                                        <button
                                            type={'button'}
                                            onClick={() => sort(column.name)}
                                            title={column.type}
                                            className={
                                                'w-full flex items-center gap-1.5 px-3 py-2.5 text-gray-300 hover:text-white'
                                            }
                                        >
                                            {data.primary.includes(column.name) && (
                                                <KeyIcon className={'w-3.5 h-3.5 text-amber-300'} />
                                            )}
                                            <span className={'font-mono text-xs'}>{column.name}</span>
                                            <span className={'text-[0.65rem] font-normal text-gray-600'}>
                                                {column.data_type}
                                            </span>
                                            {query.sort === column.name &&
                                                (query.direction === 'desc' ? (
                                                    <ChevronDownIcon className={'w-3.5 h-3.5 text-raptor-400'} />
                                                ) : (
                                                    <ChevronUpIcon className={'w-3.5 h-3.5 text-raptor-400'} />
                                                ))}
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, r) => {
                                const isSelected = selected.includes(r);

                                return (
                                    <tr
                                        key={r}
                                        onClick={() => !view && setEditing({ row: r })}
                                        className={classNames(
                                            'group',
                                            !view && 'cursor-pointer',
                                            isSelected ? 'bg-raptor-500/[0.07]' : 'hover:bg-white/[0.025]'
                                        )}
                                    >
                                        {!view && (
                                            <td
                                                className={classNames(
                                                    'sticky left-0 z-[5] px-3 py-2 border-b border-gray-800/70',
                                                    isSelected ? 'bg-[#0f1a12]' : 'bg-gray-900 group-hover:bg-[#15171a]'
                                                )}
                                            >
                                                <Box
                                                    state={isSelected ? 'on' : 'off'}
                                                    label={t('Select row')}
                                                    onClick={() =>
                                                        setSelected((s) =>
                                                            s.includes(r) ? s.filter((x) => x !== r) : [...s, r]
                                                        )
                                                    }
                                                />
                                            </td>
                                        )}
                                        {row.map((value: DbValue, c) => (
                                            <td
                                                key={c}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    !view && setEditing({ row: r, focus: columns[c].name });
                                                }}
                                                title={valueText(value).slice(0, 500)}
                                                className={
                                                    'px-3 py-2 border-b border-gray-800/70 max-w-[22rem] truncate font-mono text-xs text-gray-200'
                                                }
                                            >
                                                <Cell value={value} />
                                                {truncated.get(r)?.includes(c) && (
                                                    <span className={'text-gray-600'}> …</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {pages && rows.length > 0 && (
                <div className={'flex flex-wrap items-center gap-3 text-sm text-gray-400'}>
                    <span>
                        {t('{{from}}–{{to}} of {{total}}', {
                            from: (pages.current_page - 1) * pages.per_page + 1,
                            to: (pages.current_page - 1) * pages.per_page + rows.length,
                            total: pages.total.toLocaleString(),
                        })}
                    </span>
                    <select
                        value={query.per_page}
                        onChange={(e) => setQuery((q) => ({ ...q, per_page: Number(e.target.value), page: 1 }))}
                        className={classNames(control, 'py-1')}
                        aria-label={t('Rows per page')}
                    >
                        {[25, 50, 100, 250, 500].map((n) => (
                            <option key={n} value={n}>
                                {t('{{count}} per page', { count: n })}
                            </option>
                        ))}
                    </select>
                    <span className={'flex-1'} />
                    <div className={'flex items-center gap-1'}>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={ChevronLeftIcon}
                            aria-label={t('Previous page')}
                            disabled={pages.current_page <= 1}
                            onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
                        />
                        <span className={'px-2 tabular-nums'}>
                            {pages.current_page} / {pages.total_pages}
                        </span>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={ChevronRightIcon}
                            aria-label={t('Next page')}
                            disabled={pages.current_page >= pages.total_pages}
                            onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
                        />
                    </div>
                </div>
            )}

            {data && (
                <RowEditor
                    open={editing !== null}
                    onClose={() => setEditing(null)}
                    onSaved={() => mutate()}
                    uuid={uuid}
                    database={database}
                    table={table}
                    columns={data.columns}
                    primary={data.primary}
                    row={editing?.row !== undefined ? data.rows[editing.row] : undefined}
                    truncated={editing?.row !== undefined ? truncated.get(editing.row) : undefined}
                    focus={editing?.focus}
                />
            )}
            <Confirm
                open={confirmDelete}
                title={t('Delete {{count}} rows?', { count: selected.length })}
                confirm={t('Delete rows')}
                loading={deleting}
                onConfirm={remove}
                onClose={() => setConfirmDelete(false)}
            >
                {t('The selected rows are removed from {{table}} permanently.', { table })}
            </Confirm>
        </div>
    );
};

export default BrowseTab;
