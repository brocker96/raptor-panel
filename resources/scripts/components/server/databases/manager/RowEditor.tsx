import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { KeyIcon, PencilAltIcon, PlusIcon } from '@heroicons/react/outline';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout } from '@/components/admin/ui/Feedback';
import { toast } from '@/components/admin/ui/Toast';
import { DbColumn, DbValue, insertRow, updateRow } from '@/api/server/databases/manager';
import { columnKind, enumOptions, isBinary, rowKey } from '@/components/server/databases/manager/values';
import { t } from '@/i18n';

interface Props {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    uuid: string;
    database: string;
    table: string;
    columns: DbColumn[];
    primary: string[];
    /** The row being edited, a new row is inserted when undefined. */
    row?: DbValue[];
    /** Indexes of the cells of the row that were cut by the API and cannot be edited. */
    truncated?: number[];
    /** Column focused when the editor opens. */
    focus?: string;
}

interface FieldState {
    value: string;
    isNull: boolean;
    touched: boolean;
}

const initial = (column: DbColumn, value: DbValue | undefined): FieldState => {
    if (value === undefined) {
        return {
            value: '',
            isNull: column.nullable && column.default === null && !column.auto_increment,
            touched: false,
        };
    }

    return {
        value:
            value === null || isBinary(value) ? '' : typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
        isNull: value === null,
        touched: false,
    };
};

const inputClass =
    'w-full rounded-lg bg-gray-950/60 px-3 py-2 text-sm text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500 disabled:opacity-50';

const RowEditor = ({
    open,
    onClose,
    onSaved,
    uuid,
    database,
    table,
    columns,
    primary,
    row,
    truncated = [],
    focus,
}: Props) => {
    const [fields, setFields] = useState<FieldState[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const focusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setFields(columns.map((column, i) => initial(column, row?.[i])));
        setError('');
        setTimeout(() => focusRef.current?.focus(), 250);
    }, [open, row, columns]);

    const changed = useMemo(() => fields.filter((f) => f.touched).length, [fields]);

    const set = (index: number, patch: Partial<FieldState>) =>
        setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch, touched: true } : f)));

    const save = async () => {
        const values: Record<string, unknown> = {};
        fields.forEach((field, i) => {
            const column = columns[i];
            if (!field.touched || column.binary || truncated.includes(i)) return;
            values[column.name] = field.isNull ? null : field.value;
        });

        setSaving(true);
        setError('');
        try {
            if (row) {
                if (!Object.keys(values).length) {
                    onClose();
                    return;
                }
                const { affected } = await updateRow(uuid, database, table, rowKey(columns, primary, row), values);
                toast.success(affected ? t('Row saved') : t('Nothing changed'));
            } else {
                await insertRow(uuid, database, table, values);
                toast.success(t('Row added'));
            }
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.errors?.[0]?.detail || err?.message || t('Something went wrong'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={saving}
            size={'lg'}
            icon={row ? PencilAltIcon : PlusIcon}
            title={row ? t('Edit row') : t('Insert row')}
            description={
                <span>
                    {t('Table')} <span className={'font-mono text-gray-200'}>{table}</span>
                    {!row && ' · ' + t('Fields left untouched get their default value.')}
                </span>
            }
            footer={
                <>
                    <span className={'hidden sm:block mr-auto text-xs text-gray-500'}>
                        {changed ? t('{{count}} changed fields', { count: changed }) : t('No changes yet')}
                    </span>
                    <Button variant={'secondary'} onClick={onClose} disabled={saving}>
                        {t('Cancel')}
                    </Button>
                    <Button onClick={save} loading={saving} disabled={!!row && !changed}>
                        {row ? t('Save row') : t('Insert row')}
                    </Button>
                </>
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'} title={t('The database refused the change')}>
                        <span className={'font-mono text-xs break-words'}>{error}</span>
                    </Callout>
                </div>
            )}
            <form
                className={'space-y-4'}
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                {columns.map((column, i) => {
                    const field = fields[i];
                    if (!field) return null;
                    const kind = columnKind(column);
                    const locked = column.binary || truncated.includes(i);
                    const disabled = locked || field.isNull;
                    const id = `row-field-${i}`;
                    const common = {
                        id,
                        disabled,
                        value: field.value,
                        ref:
                            column.name === focus || (!focus && i === 0)
                                ? (el: HTMLElement | null) => (focusRef.current = el)
                                : undefined,
                        className: classNames(inputClass, kind === 'long' && 'font-mono text-xs min-h-[6rem]'),
                        placeholder:
                            column.auto_increment && !row
                                ? t('Automatic')
                                : column.default !== null && !row
                                ? String(column.default)
                                : undefined,
                    };

                    return (
                        <div
                            key={column.name}
                            className={classNames(
                                'rounded-xl p-3 -mx-3',
                                field.touched && 'bg-raptor-500/[0.04] ring-1 ring-inset ring-raptor-500/15'
                            )}
                        >
                            <div className={'flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5'}>
                                <label htmlFor={id} className={'text-sm font-medium text-gray-100 font-mono break-all'}>
                                    {column.name}
                                </label>
                                {primary.includes(column.name) && (
                                    <KeyIcon className={'w-3.5 h-3.5 text-amber-300'} aria-label={t('Primary key')} />
                                )}
                                <span className={'text-xs text-gray-500 font-mono'}>{column.type}</span>
                                {column.nullable && (
                                    <label
                                        className={
                                            'ml-auto inline-flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none'
                                        }
                                    >
                                        <input
                                            type={'checkbox'}
                                            disabled={locked}
                                            checked={field.isNull}
                                            onChange={(e) => set(i, { isNull: e.target.checked })}
                                            className={
                                                'rounded border-gray-600 bg-gray-900 text-raptor-500 focus:ring-raptor-500'
                                            }
                                        />
                                        NULL
                                    </label>
                                )}
                            </div>
                            {locked ? (
                                <p className={'text-xs text-gray-500'}>
                                    {column.binary
                                        ? t('Binary data cannot be edited here, use the SQL console instead.')
                                        : t('This value is too long to edit here, use the SQL console instead.')}
                                </p>
                            ) : kind === 'long' ? (
                                <textarea {...common} onChange={(e) => set(i, { value: e.target.value })} rows={4} />
                            ) : kind === 'enum' ? (
                                <select {...common} onChange={(e) => set(i, { value: e.target.value })}>
                                    {!field.value && <option value={''}>{t('Choose…')}</option>}
                                    {enumOptions(column).map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    {...common}
                                    type={'text'}
                                    inputMode={kind === 'number' ? 'decimal' : undefined}
                                    onChange={(e) => set(i, { value: e.target.value })}
                                    placeholder={
                                        common.placeholder ??
                                        (kind === 'datetime'
                                            ? 'YYYY-MM-DD HH:MM:SS'
                                            : kind === 'date'
                                            ? 'YYYY-MM-DD'
                                            : kind === 'time'
                                            ? 'HH:MM:SS'
                                            : undefined)
                                    }
                                />
                            )}
                            {column.comment && <p className={'mt-1 text-xs text-gray-500'}>{column.comment}</p>}
                            {column.auto_increment && (
                                <Badge tone={'gray'} className={'mt-1.5'}>
                                    AUTO_INCREMENT
                                </Badge>
                            )}
                        </div>
                    );
                })}
                <button type={'submit'} className={'hidden'} />
            </form>
        </Modal>
    );
};

export default RowEditor;
