import React from 'react';
import classNames from 'classnames';
import { DbColumn, DbValue } from '@/api/server/databases/manager';
import { formatBytes } from '@/components/admin/ui/hooks';
import { t } from '@/i18n';

export const isBinary = (value: DbValue): value is { $binary: number } =>
    typeof value === 'object' && value !== null && '$binary' in value;

/** Text of a value as shown in a grid cell or copied to the clipboard. */
export const valueText = (value: DbValue): string => {
    if (value === null) return 'NULL';
    if (isBinary(value)) return t('binary · {{size}}', { size: formatBytes(value.$binary) });
    if (typeof value === 'boolean') return value ? '1' : '0';

    return String(value);
};

export const Cell = ({ value, className }: { value: DbValue; className?: string }) => {
    if (value === null) {
        return <span className={classNames('text-gray-600 italic', className)}>NULL</span>;
    }
    if (isBinary(value)) {
        return <span className={classNames('text-amber-300/80', className)}>{valueText(value)}</span>;
    }
    if (typeof value === 'number') {
        return <span className={classNames('text-sky-300 tabular-nums', className)}>{value}</span>;
    }
    if (value === '') {
        return <span className={classNames('text-gray-700', className)}>{t('empty')}</span>;
    }

    return <span className={className}>{String(value)}</span>;
};

const NUMERIC = [
    'tinyint',
    'smallint',
    'mediumint',
    'int',
    'integer',
    'bigint',
    'decimal',
    'numeric',
    'float',
    'double',
    'real',
    'bit',
    'year',
];
const LONG_TEXT = ['text', 'mediumtext', 'longtext', 'json', 'tinytext'];

export type ColumnKind = 'number' | 'text' | 'long' | 'enum' | 'date' | 'datetime' | 'time' | 'binary';

export const columnKind = (column: DbColumn): ColumnKind => {
    if (column.binary) return 'binary';
    if (NUMERIC.includes(column.data_type)) return 'number';
    if (LONG_TEXT.includes(column.data_type)) return 'long';
    if (column.data_type === 'enum') return 'enum';
    if (column.data_type === 'date') return 'date';
    if (column.data_type === 'datetime' || column.data_type === 'timestamp') return 'datetime';
    if (column.data_type === 'time') return 'time';

    return 'text';
};

/** Values allowed by an enum column, parsed from its type such as enum('a','b'). */
export const enumOptions = (column: DbColumn): string[] =>
    [...column.type.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'"));

/** Values that identify a row, the primary key or every non binary column when there is none. */
export const rowKey = (columns: DbColumn[], primary: string[], row: DbValue[]): Record<string, DbValue> => {
    const names = primary.length ? primary : columns.filter((c) => !c.binary).map((c) => c.name);

    return Object.fromEntries(names.map((name) => [name, row[columns.findIndex((c) => c.name === name)]]));
};

export const toCsv = (columns: string[], rows: DbValue[][]): string => {
    const escape = (value: DbValue) => {
        if (value === null) return '';
        const text = valueText(value);

        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return [columns.map((c) => escape(c)), ...rows.map((row) => row.map(escape))].map((r) => r.join(',')).join('\r\n');
};

export const downloadText = (name: string, content: string, type = 'text/csv') => {
    const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const ident = (name: string) => '`' + name.replace(/`/g, '``') + '`';
