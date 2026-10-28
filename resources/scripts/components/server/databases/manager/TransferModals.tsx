import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { CheckIcon } from '@heroicons/react/solid';
import { CloudDownloadIcon, CloudUploadIcon, DocumentTextIcon } from '@heroicons/react/outline';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { Toggle } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import { formatBytes } from '@/components/admin/ui/hooks';
import { DbImportResult, DbTable, exportSql, importSql } from '@/api/server/databases/manager';
import { t } from '@/i18n';

interface Base {
    open: boolean;
    onClose: () => void;
    uuid: string;
    database: string;
}

export const ExportModal = ({ open, onClose, uuid, database, tables }: Base & { tables: DbTable[] }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [data, setData] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) setSelected(tables.map((table) => table.name));
    }, [open, tables]);

    const all = selected.length === tables.length;

    const download = async () => {
        setBusy(true);
        try {
            await exportSql(uuid, database, all ? [] : selected, data);
            toast.success(t('Export downloaded'));
            onClose();
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            icon={CloudDownloadIcon}
            title={t('Export database')}
            description={t('Download a .sql dump that can be imported here again or into any other MySQL server.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button icon={CloudDownloadIcon} loading={busy} disabled={!selected.length} onClick={download}>
                        {t('Download')}
                    </Button>
                </>
            }
        >
            <Toggle
                label={t('Include the data')}
                description={t('Turn off to export only the structure of the tables.')}
                checked={data}
                onChange={setData}
            />
            <div className={'mt-5 flex items-center justify-between'}>
                <p className={'text-xs font-medium uppercase tracking-wide text-gray-500'}>
                    {t('{{count}} of {{total}} tables', { count: selected.length, total: tables.length })}
                </p>
                <button
                    type={'button'}
                    className={'text-xs text-raptor-400 hover:text-raptor-300'}
                    onClick={() => setSelected(all ? [] : tables.map((table) => table.name))}
                >
                    {all ? t('Select none') : t('Select all')}
                </button>
            </div>
            <ul className={'mt-2 max-h-64 overflow-auto rounded-xl ring-1 ring-gray-800 divide-y divide-gray-800'}>
                {tables.map((table) => {
                    const on = selected.includes(table.name);

                    return (
                        <li key={table.name}>
                            <button
                                type={'button'}
                                onClick={() =>
                                    setSelected((s) => (on ? s.filter((x) => x !== table.name) : [...s, table.name]))
                                }
                                className={'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.03]'}
                            >
                                <span
                                    className={classNames(
                                        'grid place-items-center w-4 h-4 rounded ring-1 ring-inset flex-shrink-0',
                                        on ? 'bg-raptor-500 ring-raptor-400 text-gray-950' : 'ring-gray-600'
                                    )}
                                >
                                    {on && <CheckIcon className={'w-3 h-3'} />}
                                </span>
                                <span className={'flex-1 min-w-0 truncate font-mono text-sm text-gray-200'}>
                                    {table.name}
                                </span>
                                <span className={'text-xs text-gray-500 tabular-nums'}>{formatBytes(table.size)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Modal>
    );
};

export const ImportModal = ({ open, onClose, uuid, database, onImported }: Base & { onImported: () => void }) => {
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [result, setResult] = useState<DbImportResult | null>(null);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFile(null);
        setProgress(null);
        setResult(null);
    }, [open]);

    const busy = progress !== null && !result;

    const start = async () => {
        if (!file) return;
        setProgress(0);
        try {
            const output = await importSql(uuid, database, file, setProgress);
            setResult(output);
            onImported();
            if (!output.error)
                toast.success(t('Import finished'), t('{{count}} statements', { count: output.executed }));
        } catch (err) {
            setProgress(null);
            toast.fromError(err);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            icon={CloudUploadIcon}
            title={t('Import SQL file')}
            description={t(
                'Runs every statement of a .sql file, for example a dump made with mysqldump or the export of the DB Manager.'
            )}
            footer={
                result ? (
                    <Button onClick={onClose}>{t('Done')}</Button>
                ) : (
                    <>
                        <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                            {t('Cancel')}
                        </Button>
                        <Button icon={CloudUploadIcon} loading={busy} disabled={!file} onClick={start}>
                            {t('Import')}
                        </Button>
                    </>
                )
            }
        >
            {result ? (
                result.error ? (
                    <Callout tone={'red'} title={t('Stopped after {{count}} statements', { count: result.executed })}>
                        <p className={'font-mono text-xs break-words'}>{result.error}</p>
                        {result.statement && (
                            <pre
                                className={
                                    'mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] text-rose-200/70'
                                }
                            >
                                {result.statement}
                            </pre>
                        )}
                    </Callout>
                ) : (
                    <Callout tone={'green'} title={t('Import finished')}>
                        {t('{{count}} statements ran in {{seconds}} s.', {
                            count: result.executed,
                            seconds: result.time,
                        })}
                    </Callout>
                )
            ) : (
                <>
                    <button
                        type={'button'}
                        disabled={busy}
                        onClick={() => input.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                        }}
                        className={classNames(
                            'w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                            dragging ? 'border-raptor-500 bg-raptor-500/5' : 'border-gray-700 hover:border-gray-500'
                        )}
                    >
                        <DocumentTextIcon className={'mx-auto w-8 h-8 text-gray-500'} />
                        {file ? (
                            <>
                                <p className={'mt-2 text-sm text-gray-100 break-all'}>{file.name}</p>
                                <p className={'text-xs text-gray-500'}>{formatBytes(file.size)}</p>
                            </>
                        ) : (
                            <>
                                <p className={'mt-2 text-sm text-gray-200'}>
                                    {t('Drop a .sql file here or click to choose one')}
                                </p>
                                <p className={'text-xs text-gray-500'}>{t('Up to 50 MB')}</p>
                            </>
                        )}
                    </button>
                    <input
                        ref={input}
                        type={'file'}
                        accept={'.sql,.txt'}
                        className={'hidden'}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {progress !== null && (
                        <div className={'mt-4'}>
                            <div className={'flex justify-between text-xs text-gray-400 mb-1'}>
                                <span>{progress < 100 ? t('Uploading…') : t('Running statements…')}</span>
                                <span className={'tabular-nums'}>{progress}%</span>
                            </div>
                            <div className={'h-1.5 rounded-full bg-gray-800 overflow-hidden'}>
                                <div
                                    className={classNames(
                                        'h-full bg-raptor-500 transition-all',
                                        progress >= 100 && 'animate-pulse'
                                    )}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                    <div className={'mt-4'}>
                        <Callout tone={'yellow'}>
                            {t(
                                'Statements in the file can overwrite or delete existing tables. Export a backup first if you are not sure.'
                            )}
                        </Callout>
                    </div>
                </>
            )}
        </Modal>
    );
};
