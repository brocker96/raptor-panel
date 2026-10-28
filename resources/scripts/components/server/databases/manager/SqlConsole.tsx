import React, { Suspense, lazy, useRef, useState } from 'react';
import classNames from 'classnames';
import {
    CheckCircleIcon,
    ClockIcon,
    DownloadIcon,
    ExclamationCircleIcon,
    PlayIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import type { EditorHandle } from '@/components/elements/editor/Editor';
import { DbQueryResult, runQuery } from '@/api/server/databases/manager';
import Button from '@/components/admin/ui/Button';
import { Skeleton } from '@/components/admin/ui/Feedback';
import { toast } from '@/components/admin/ui/Toast';
import { Cell, downloadText, ident, toCsv, valueText } from '@/components/server/databases/manager/values';
import { t } from '@/i18n';

const Editor = lazy(() => import('@/components/elements/editor/Editor'));

interface Props {
    uuid: string;
    database: string;
    /** Table the snippets refer to. */
    table?: string;
    /** Called after statements that may have changed the schema or data. */
    onChanged: () => void;
}

const historyKey = (database: string) => `raptor:db-manager:history:${database}`;

const loadHistory = (database: string): string[] => {
    try {
        return JSON.parse(localStorage.getItem(historyKey(database)) || '[]');
    } catch {
        return [];
    }
};

const saveHistory = (database: string, history: string[]) => {
    try {
        localStorage.setItem(historyKey(database), JSON.stringify(history.slice(0, 30)));
    } catch {
        // Storage can be unavailable in private windows.
    }
};

const ResultCard = ({ result, index }: { result: DbQueryResult; index: number }) => {
    const sql = result.sql.length > 300 ? result.sql.slice(0, 300) + '…' : result.sql;

    return (
        <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 overflow-hidden'}>
            <div className={'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-gray-800'}>
                {result.error ? (
                    <ExclamationCircleIcon className={'w-4 h-4 text-rose-400 flex-shrink-0'} />
                ) : (
                    <CheckCircleIcon className={'w-4 h-4 text-raptor-400 flex-shrink-0'} />
                )}
                <code className={'flex-1 min-w-0 truncate text-xs text-gray-300'} title={result.sql}>
                    <span className={'text-gray-600 mr-2'}>#{index + 1}</span>
                    {sql}
                </code>
                {result.time !== undefined && (
                    <span className={'text-xs text-gray-500 tabular-nums'}>{t('{{ms}} ms', { ms: result.time })}</span>
                )}
                {result.rows && (
                    <span className={'text-xs text-gray-400'}>
                        {result.limited
                            ? t('first {{count}} rows', { count: result.rows.length })
                            : t('{{count}} rows', { count: result.rows.length })}
                    </span>
                )}
                {result.rows && result.rows.length > 0 && (
                    <Button
                        variant={'ghost'}
                        size={'sm'}
                        icon={DownloadIcon}
                        aria-label={t('Download as CSV')}
                        title={t('Download as CSV')}
                        onClick={() =>
                            downloadText(
                                `result-${index + 1}.csv`,
                                toCsv(
                                    result.columns!.map((c) => c.name),
                                    result.rows!
                                )
                            )
                        }
                    />
                )}
            </div>
            {result.error ? (
                <p className={'px-4 py-3 text-sm text-rose-300 font-mono break-words'}>
                    {result.code ? <span className={'text-rose-400/70 mr-2'}>#{result.code}</span> : null}
                    {result.error}
                </p>
            ) : result.rows ? (
                result.rows.length ? (
                    <div className={'overflow-auto max-h-[50vh]'}>
                        <table className={'min-w-full text-xs font-mono border-separate border-spacing-0'}>
                            <thead>
                                <tr>
                                    {result.columns!.map((column, i) => (
                                        <th
                                            key={i}
                                            className={
                                                'sticky top-0 bg-gray-900 px-3 py-2 text-left font-medium text-gray-300 border-b border-gray-800 whitespace-nowrap'
                                            }
                                        >
                                            {column.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.map((row, r) => (
                                    <tr key={r} className={'hover:bg-white/[0.025]'}>
                                        {row.map((value, c) => (
                                            <td
                                                key={c}
                                                title={valueText(value).slice(0, 500)}
                                                className={
                                                    'px-3 py-1.5 border-b border-gray-800/70 max-w-[22rem] truncate text-gray-200'
                                                }
                                            >
                                                <Cell value={value} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className={'px-4 py-3 text-sm text-gray-500'}>{t('The query returned no rows.')}</p>
                )
            ) : (
                <p className={'px-4 py-3 text-sm text-gray-300'}>
                    {t('{{count}} rows affected', { count: result.affected ?? 0 })}
                </p>
            )}
        </div>
    );
};

const SqlConsole = ({ uuid, database, table, onChanged }: Props) => {
    const editor = useRef<EditorHandle>(null);
    const [initial, setInitial] = useState(() => (table ? `SELECT * FROM ${ident(table)} LIMIT 100;` : 'SHOW TABLES;'));
    const [version, setVersion] = useState(0);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<DbQueryResult[] | null>(null);
    const [history, setHistory] = useState(() => loadHistory(database));
    const [showHistory, setShowHistory] = useState(false);

    const load = (sql: string) => {
        setInitial(sql);
        setVersion((v) => v + 1);
        setShowHistory(false);
    };

    const run = async () => {
        const sql = editor.current?.getValue().trim() || '';
        if (!sql || running) return;

        setRunning(true);
        try {
            const output = await runQuery(uuid, database, sql);
            setResults(output);

            const next = [sql, ...history.filter((h) => h !== sql)].slice(0, 30);
            setHistory(next);
            saveHistory(database, next);

            if (output.some((r) => r.affected !== undefined)) onChanged();
        } catch (err) {
            toast.fromError(err);
        } finally {
            setRunning(false);
        }
    };

    const snippets = [
        { label: 'SELECT', sql: `SELECT * FROM ${ident(table || 'table')} WHERE 1 LIMIT 100;` },
        { label: 'INSERT', sql: `INSERT INTO ${ident(table || 'table')} (\`column\`) VALUES ('value');` },
        { label: 'UPDATE', sql: `UPDATE ${ident(table || 'table')} SET \`column\` = 'value' WHERE \`id\` = 1;` },
        {
            label: 'CREATE TABLE',
            sql: 'CREATE TABLE `players` (\n  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,\n  `uuid` CHAR(36) NOT NULL UNIQUE,\n  `name` VARCHAR(32) NOT NULL,\n  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n);',
        },
        { label: 'SHOW PROCESSLIST', sql: 'SHOW PROCESSLIST;' },
    ];

    const errors = results?.filter((r) => r.error).length || 0;

    return (
        <div className={'space-y-4'}>
            <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 overflow-hidden'}>
                <div className={'flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-800'}>
                    {snippets.map((snippet) => (
                        <button
                            key={snippet.label}
                            type={'button'}
                            onClick={() => load(snippet.sql)}
                            className={
                                'px-2 py-1 rounded-md text-[0.7rem] font-mono text-gray-400 hover:text-gray-100 hover:bg-white/5'
                            }
                        >
                            {snippet.label}
                        </button>
                    ))}
                    <span className={'flex-1'} />
                    <div className={'relative'}>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={ClockIcon}
                            disabled={!history.length}
                            onClick={() => setShowHistory((v) => !v)}
                        >
                            {t('History')}
                        </Button>
                        {showHistory && (
                            <div
                                className={
                                    'absolute right-0 top-full mt-1 z-30 w-[min(28rem,85vw)] max-h-80 overflow-auto rounded-xl bg-gray-900 ring-1 ring-gray-700 shadow-2xl py-1'
                                }
                            >
                                {history.map((sql, i) => (
                                    <button
                                        key={i}
                                        type={'button'}
                                        onClick={() => load(sql)}
                                        className={
                                            'block w-full text-left px-3 py-2 font-mono text-xs text-gray-300 hover:bg-white/5 truncate'
                                        }
                                    >
                                        {sql.replace(/\s+/g, ' ')}
                                    </button>
                                ))}
                                <button
                                    type={'button'}
                                    onClick={() => {
                                        setHistory([]);
                                        saveHistory(database, []);
                                        setShowHistory(false);
                                    }}
                                    className={
                                        'flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 border-t border-gray-800'
                                    }
                                >
                                    <TrashIcon className={'w-3.5 h-3.5'} />
                                    {t('Clear history')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className={'h-56 [&_.cm-editor]:h-full [&_.cm-content]:!pb-4'}>
                    <Suspense fallback={<Skeleton className={'h-full rounded-none'} />}>
                        <Editor
                            key={version}
                            ref={editor}
                            className={'h-full'}
                            initialContent={initial}
                            language={'MySQL'}
                            lineWrapping={false}
                            onRun={run}
                        />
                    </Suspense>
                </div>
                <div className={'flex flex-wrap items-center gap-3 px-3 py-2 border-t border-gray-800'}>
                    <span className={'text-xs text-gray-500'}>
                        {t('Several statements can be separated with ;')} · <kbd className={'font-mono'}>Ctrl</kbd> +{' '}
                        <kbd className={'font-mono'}>Enter</kbd>
                    </span>
                    <span className={'flex-1'} />
                    {results && (
                        <Button variant={'ghost'} size={'sm'} onClick={() => setResults(null)}>
                            {t('Clear results')}
                        </Button>
                    )}
                    <Button size={'sm'} icon={PlayIcon} loading={running} onClick={run}>
                        {t('Run')}
                    </Button>
                </div>
            </div>

            {results && (
                <div className={'space-y-3'}>
                    <p className={classNames('text-sm', errors ? 'text-rose-300' : 'text-gray-400')}>
                        {errors
                            ? t('Stopped at statement {{index}} because of an error.', { index: results.length })
                            : t('{{count}} statements ran successfully.', { count: results.length })}
                    </p>
                    {results.map((result, i) => (
                        <ResultCard key={i} result={result} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SqlConsole;
