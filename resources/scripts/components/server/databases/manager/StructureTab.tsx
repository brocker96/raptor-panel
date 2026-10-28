import React from 'react';
import { ClipboardCopyIcon, KeyIcon, LinkIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getStructure } from '@/api/server/databases/manager';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { toast } from '@/components/admin/ui/Toast';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-400 whitespace-nowrap';
const td = 'px-4 py-2.5 border-t border-gray-800 align-top';

const StructureTab = ({ uuid, database, table }: { uuid: string; database: string; table: string }) => {
    const { data, error } = useResource(['server', uuid, 'db-manager', database, 'structure', table], () =>
        getStructure(uuid, database, table)
    );

    if (error) return <Callout tone={'red'}>{httpErrorToHuman(error)}</Callout>;
    if (!data) return <Skeleton className={'h-80 rounded-xl'} />;

    const copy = () => navigator.clipboard.writeText(data.create).then(() => toast.success(t('Copied to clipboard')));

    return (
        <div className={'space-y-5'}>
            <Card flush title={t('{{count}} columns', { count: data.columns.length })}>
                <div className={'overflow-x-auto'}>
                    <table className={'min-w-full text-sm'}>
                        <thead>
                            <tr>
                                <th className={th}>{t('Name')}</th>
                                <th className={th}>{t('Type')}</th>
                                <th className={th}>{t('Null')}</th>
                                <th className={th}>{t('Default')}</th>
                                <th className={th}>{t('Extra')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.columns.map((column) => (
                                <tr key={column.name}>
                                    <td className={td}>
                                        <span className={'inline-flex items-center gap-1.5 font-mono text-gray-100'}>
                                            {data.primary.includes(column.name) && (
                                                <KeyIcon className={'w-3.5 h-3.5 text-amber-300'} />
                                            )}
                                            {column.name}
                                        </span>
                                        {column.comment && (
                                            <p className={'mt-0.5 text-xs text-gray-500'}>{column.comment}</p>
                                        )}
                                    </td>
                                    <td className={`${td} font-mono text-xs text-sky-300 break-all`}>{column.type}</td>
                                    <td className={td}>
                                        {column.nullable ? (
                                            <Badge tone={'gray'}>{t('Yes')}</Badge>
                                        ) : (
                                            <span className={'text-gray-600'}>{t('No')}</span>
                                        )}
                                    </td>
                                    <td className={`${td} font-mono text-xs text-gray-300`}>
                                        {column.default === null ? (
                                            <span className={'text-gray-600 italic'}>
                                                {column.nullable ? 'NULL' : '—'}
                                            </span>
                                        ) : (
                                            column.default
                                        )}
                                    </td>
                                    <td className={`${td} font-mono text-xs text-gray-400`}>{column.extra || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className={'grid lg:grid-cols-2 gap-5 items-start'}>
                <Card flush title={t('Indexes')}>
                    {data.indexes.length ? (
                        <ul className={'divide-y divide-gray-800'}>
                            {data.indexes.map((index) => (
                                <li key={index.name} className={'px-4 py-3 flex flex-wrap items-center gap-2'}>
                                    <span className={'font-mono text-sm text-gray-100'}>{index.name}</span>
                                    {index.primary ? (
                                        <Badge tone={'yellow'}>PRIMARY</Badge>
                                    ) : index.unique ? (
                                        <Badge tone={'blue'}>UNIQUE</Badge>
                                    ) : (
                                        <Badge tone={'gray'}>{index.type}</Badge>
                                    )}
                                    <span className={'w-full sm:w-auto sm:ml-auto font-mono text-xs text-gray-400'}>
                                        {index.columns.join(', ')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={'px-4 py-6 text-sm text-gray-500'}>{t('This table has no indexes.')}</p>
                    )}
                </Card>
                <Card flush title={t('Foreign keys')}>
                    {data.foreign_keys.length ? (
                        <ul className={'divide-y divide-gray-800'}>
                            {data.foreign_keys.map((key) => (
                                <li
                                    key={key.name + key.column}
                                    className={'px-4 py-3 flex items-center gap-2 font-mono text-xs text-gray-300'}
                                >
                                    <LinkIcon className={'w-4 h-4 text-gray-500 flex-shrink-0'} />
                                    <span className={'break-all'}>
                                        {key.column} → {key.table}.{key.references}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={'px-4 py-6 text-sm text-gray-500'}>{t('This table has no foreign keys.')}</p>
                    )}
                </Card>
            </div>

            <Card
                flush
                title={t('CREATE statement')}
                actions={
                    <Button variant={'ghost'} size={'sm'} icon={ClipboardCopyIcon} onClick={copy}>
                        {t('Copy')}
                    </Button>
                }
            >
                <pre className={'px-4 py-3 overflow-x-auto text-xs leading-relaxed font-mono text-gray-300'}>
                    {data.create}
                </pre>
            </Card>
        </div>
    );
};

export default StructureTab;
