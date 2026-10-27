import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from '@heroicons/react/outline';
import { Skeleton } from '@/components/admin/ui/Feedback';

export interface Column<T> {
    key: string;
    header: React.ReactNode;
    cell: (row: T) => React.ReactNode;
    className?: string;
    /** Hidden below the given breakpoint, the mobile card layout shows the essentials instead. */
    hideBelow?: 'md' | 'lg' | 'xl';
    align?: 'right';
}

interface Props<T> {
    rows: T[] | undefined;
    columns: Column<T>[];
    rowKey: (row: T) => string | number;
    onRowClick?: (row: T) => void;
    /** Card layout used on phones. Defaults to stacking the first columns. */
    mobile?: (row: T) => React.ReactNode;
    empty?: React.ReactNode;
    loading?: boolean;
    /** Checkbox selection. */
    selected?: Set<string | number>;
    onSelect?: (keys: Set<string | number>) => void;
}

const hide = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

export function DataTable<T>({
    rows,
    columns,
    rowKey,
    onRowClick,
    mobile,
    empty,
    loading,
    selected,
    onSelect,
}: Props<T>) {
    if (!rows || (loading && rows.length === 0)) {
        return (
            <div className={'p-4 space-y-3'}>
                {[...Array(6)].map((_, index) => (
                    <Skeleton key={index} className={'h-10'} />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return <>{empty}</>;
    }

    const allSelected = !!selected && rows.every((row) => selected.has(rowKey(row)));
    const toggle = (key: string | number) => {
        if (!selected || !onSelect) return;
        const next = new Set(selected);
        next.has(key) ? next.delete(key) : next.add(key);
        onSelect(next);
    };

    return (
        <div className={classNames('transition-opacity', { 'opacity-60': loading })}>
            {/* Phones get a list of cards instead of a horizontally scrolling table. */}
            <ul className={'sm:hidden divide-y divide-gray-800'}>
                {rows.map((row, index) => (
                    <motion.li
                        key={rowKey(row)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 12) * 0.025 }}
                        onClick={() => onRowClick?.(row)}
                        className={classNames('flex items-start gap-3 px-4 py-3', {
                            'active:bg-white/5 cursor-pointer': onRowClick,
                        })}
                    >
                        {selected && (
                            <input
                                type={'checkbox'}
                                className={
                                    'mt-1 form-checkbox rounded bg-gray-800 border-gray-600 text-raptor-500 focus:ring-raptor-500'
                                }
                                checked={selected.has(rowKey(row))}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggle(rowKey(row))}
                            />
                        )}
                        <div className={'flex-1 min-w-0'}>
                            {mobile
                                ? mobile(row)
                                : columns.slice(0, 3).map((column) => (
                                      <div key={column.key} className={'truncate text-sm'}>
                                          {column.cell(row)}
                                      </div>
                                  ))}
                        </div>
                    </motion.li>
                ))}
            </ul>
            <div className={'hidden sm:block overflow-x-auto'}>
                <table className={'w-full text-sm'}>
                    <thead>
                        <tr className={'border-b border-gray-800'}>
                            {selected && (
                                <th className={'w-10 pl-5'}>
                                    <input
                                        type={'checkbox'}
                                        aria-label={'Select all'}
                                        className={
                                            'form-checkbox rounded bg-gray-800 border-gray-600 text-raptor-500 focus:ring-raptor-500'
                                        }
                                        checked={allSelected}
                                        onChange={() =>
                                            onSelect?.(
                                                allSelected ? new Set() : new Set(rows.map((row) => rowKey(row)))
                                            )
                                        }
                                    />
                                </th>
                            )}
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={classNames(
                                        'px-4 first:pl-5 last:pr-5 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap',
                                        column.hideBelow && hide[column.hideBelow],
                                        column.align === 'right' && 'text-right'
                                    )}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence initial={false}>
                            {rows.map((row, index) => (
                                <motion.tr
                                    key={rowKey(row)}
                                    layout={'position'}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ delay: Math.min(index, 15) * 0.02, duration: 0.2 }}
                                    onClick={() => onRowClick?.(row)}
                                    className={classNames(
                                        'border-b border-gray-800/70 last:border-0 transition-colors',
                                        {
                                            'hover:bg-white/[0.03] cursor-pointer': onRowClick,
                                            'bg-raptor-500/5': selected?.has(rowKey(row)),
                                        }
                                    )}
                                >
                                    {selected && (
                                        <td className={'w-10 pl-5'} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type={'checkbox'}
                                                className={
                                                    'form-checkbox rounded bg-gray-800 border-gray-600 text-raptor-500 focus:ring-raptor-500'
                                                }
                                                checked={selected.has(rowKey(row))}
                                                onChange={() => toggle(rowKey(row))}
                                            />
                                        </td>
                                    )}
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={classNames(
                                                'px-4 first:pl-5 last:pr-5 py-3 text-gray-300 align-middle',
                                                column.hideBelow && hide[column.hideBelow],
                                                column.align === 'right' && 'text-right',
                                                column.className
                                            )}
                                        >
                                            {column.cell(row)}
                                        </td>
                                    ))}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export const Pagination = ({
    page,
    lastPage,
    total,
    onChange,
}: {
    page: number;
    lastPage: number;
    total: number;
    onChange: (page: number) => void;
}) => {
    if (lastPage <= 1) {
        return total > 0 ? (
            <p className={'px-5 py-3 text-xs text-gray-500 border-t border-gray-800'}>
                {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
            </p>
        ) : null;
    }

    return (
        <div
            className={
                'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-gray-800 text-xs text-gray-400'
            }
        >
            <span>
                Page <span className={'text-gray-200 font-medium'}>{page}</span> of {lastPage} ·{' '}
                {total.toLocaleString()} results
            </span>
            <div className={'flex gap-1'}>
                <button
                    type={'button'}
                    disabled={page <= 1}
                    onClick={() => onChange(page - 1)}
                    className={
                        'grid place-items-center w-8 h-8 rounded-lg ring-1 ring-inset ring-gray-700 hover:bg-white/5 disabled:opacity-40'
                    }
                    aria-label={'Previous page'}
                >
                    <ChevronLeftIcon className={'w-4 h-4'} />
                </button>
                <button
                    type={'button'}
                    disabled={page >= lastPage}
                    onClick={() => onChange(page + 1)}
                    className={
                        'grid place-items-center w-8 h-8 rounded-lg ring-1 ring-inset ring-gray-700 hover:bg-white/5 disabled:opacity-40'
                    }
                    aria-label={'Next page'}
                >
                    <ChevronRightIcon className={'w-4 h-4'} />
                </button>
            </div>
        </div>
    );
};

/** Search box that reports its value after the user stops typing. */
export const SearchInput = ({
    value,
    onChange,
    placeholder = 'Search…',
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) => {
    const [text, setText] = useState(value);

    useEffect(() => setText(value), [value]);
    useEffect(() => {
        if (text === value) return;
        const timeout = setTimeout(() => onChange(text), 300);

        return () => clearTimeout(timeout);
    }, [text]);

    return (
        <div className={classNames('relative', className)}>
            <SearchIcon
                className={'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none'}
            />
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                className={
                    'block w-full h-10 pl-9 pr-9 rounded-lg bg-gray-950/60 border-0 ring-1 ring-inset ring-gray-700 text-base sm:text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500'
                }
            />
            {text && (
                <button
                    type={'button'}
                    aria-label={'Clear search'}
                    onClick={() => {
                        setText('');
                        onChange('');
                    }}
                    className={'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:text-white'}
                >
                    <XIcon className={'w-4 h-4'} />
                </button>
            )}
        </div>
    );
};

/** Bar above a table holding the search box and filters. */
export const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <div className={'flex flex-col sm:flex-row sm:items-center gap-2 px-4 sm:px-5 pt-4 pb-3'}>{children}</div>
);
