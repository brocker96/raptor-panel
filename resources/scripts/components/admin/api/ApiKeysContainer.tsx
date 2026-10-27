import React, { useState } from 'react';
import classNames from 'classnames';
import copy from 'copy-to-clipboard';
import { motion } from 'framer-motion';
import { ClipboardCopyIcon, KeyIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { ApplicationKey, createApiKey, deleteApiKey, getApiKeys } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Column, DataTable } from '@/components/admin/ui/DataTable';
import { Badge, Callout, EmptyState } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { TextArea, TextInput } from '@/components/admin/ui/Form';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { toast } from '@/components/admin/ui/Toast';
import { ago, useAction } from '@/components/admin/ui/hooks';
import { t } from '@/i18n';

const LEVELS = [
    { value: 0, label: t('None') },
    { value: 1, label: t('Read') },
    { value: 3, label: t('Read & write') },
];

const label = (resource: string) => resource.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const Summary = ({ permissions }: { permissions: Record<string, number> }) => {
    const write = Object.values(permissions).filter((v) => v === 3).length;
    const read = Object.values(permissions).filter((v) => v === 1).length;

    return (
        <div className={'flex flex-wrap gap-1.5'}>
            {write > 0 && <Badge tone={'yellow'}>{t('{{write}} read & write', { write: write })}</Badge>}
            {read > 0 && <Badge tone={'blue'}>{t('{{read}} read', { read: read })}</Badge>}
            {!write && !read && <Badge>{t('No access')}</Badge>}
        </div>
    );
};

export default () => {
    const { data } = useResource(['admin', 'api-keys'], getApiKeys);
    const [creating, setCreating] = useState(false);
    const [memo, setMemo] = useState('');
    const [ips, setIps] = useState('');
    const [permissions, setPermissions] = useState<Record<string, number>>({});
    const [token, setToken] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<ApplicationKey | null>(null);

    const create = useAction(
        () =>
            createApiKey({
                memo,
                allowed_ips: ips.split(/[\s,]+/).filter(Boolean),
                ...Object.fromEntries(Object.entries(permissions).map(([resource, value]) => [`r_${resource}`, value])),
            }),
        {
            invalidate: [['admin', 'api-keys']],
            onSuccess: (result) => {
                setCreating(false);
                setToken(result.token);
                setMemo('');
                setIps('');
                setPermissions({});
            },
        }
    );
    const revoke = useAction((identifier: string) => deleteApiKey(identifier), {
        success: t('API key revoked'),
        invalidate: [['admin', 'api-keys']],
        onSuccess: () => setRevoking(null),
    });

    const columns: Column<ApplicationKey>[] = [
        {
            key: 'key',
            header: t('Key'),
            cell: (key) => (
                <div className={'min-w-0'}>
                    <p className={'font-medium text-gray-100 truncate'}>{key.memo || t('No description')}</p>
                    <p className={'text-xs font-mono text-gray-500'}>{key.identifier}••••</p>
                </div>
            ),
        },
        {
            key: 'permissions',
            header: t('Permissions'),
            cell: (key) => <Summary permissions={key.permissions} />,
            hideBelow: 'md',
        },
        {
            key: 'ips',
            header: t('Allowed IPs'),
            cell: (key) =>
                key.allowed_ips.length ? (
                    <span className={'text-xs font-mono'}>{key.allowed_ips.join(', ')}</span>
                ) : (
                    <span className={'text-gray-600'}>{t('Any')}</span>
                ),
            hideBelow: 'lg',
        },
        { key: 'owner', header: t('Created by'), cell: (key) => key.user?.username || '—', hideBelow: 'xl' },
        {
            key: 'used',
            header: t('Last used'),
            cell: (key) => <span className={'text-gray-500'}>{ago(key.last_used_at)}</span>,
            hideBelow: 'md',
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (key) => (
                <IconButton icon={TrashIcon} label={t('Revoke')} tone={'danger'} onClick={() => setRevoking(key)} />
            ),
        },
    ];

    const setAll = (value: number) =>
        setPermissions(Object.fromEntries((data?.resources || []).map((r) => [r, value])));

    return (
        <Page
            title={t('Application API')}
            icon={KeyIcon}
            description={t(
                'Keys for billing systems and automation. They can manage the whole Panel, keep them secret.'
            )}
            guide={'api-keys'}
            actions={
                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                    {t('Create key')}
                </Button>
            }
        >
            {token && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <Callout
                        tone={'green'}
                        icon={KeyIcon}
                        title={t('Your new API key — copy it now, it will not be shown again')}
                    >
                        <div className={'mt-2 flex items-center gap-2'}>
                            <code
                                className={
                                    'flex-1 min-w-0 truncate px-2 py-1.5 rounded bg-black/40 font-mono text-sm text-gray-100'
                                }
                            >
                                {token}
                            </code>
                            <Button
                                size={'sm'}
                                icon={ClipboardCopyIcon}
                                onClick={() => {
                                    copy(token);
                                    toast.success(t('Copied to clipboard'));
                                }}
                            >
                                {t('Copy')}
                            </Button>
                            <Button size={'sm'} variant={'ghost'} onClick={() => setToken(null)}>
                                {t('Done')}
                            </Button>
                        </div>
                    </Callout>
                </motion.div>
            )}
            <Card flush>
                <DataTable
                    rows={data?.data}
                    columns={columns}
                    rowKey={(key) => key.identifier}
                    empty={
                        <EmptyState
                            icon={KeyIcon}
                            title={t('No application keys')}
                            description={t(
                                'Create a key to connect a billing system or to automate the Panel through the API.'
                            )}
                        />
                    }
                />
            </Card>
            <Drawer
                open={creating}
                onClose={() => setCreating(false)}
                wide
                icon={KeyIcon}
                title={t('Create application key')}
                description={t('Grant only what the integration needs.')}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setCreating(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run()}>
                            {t('Create key')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-5'}>
                    <TextInput
                        label={t('Description')}
                        required
                        value={memo}
                        onChange={setMemo}
                        error={create.errors.memo}
                        placeholder={t('Paymenter billing')}
                    />
                    <TextArea
                        label={t('Allowed IPs')}
                        value={ips}
                        onChange={setIps}
                        mono
                        rows={2}
                        error={Object.entries(create.errors).find(([k]) => k.startsWith('allowed_ips'))?.[1]}
                        placeholder={'203.0.113.10\n10.0.0.0/8'}
                        description={t(
                            'One address or CIDR range per line. Leave empty to allow requests from anywhere.'
                        )}
                    />
                    <div>
                        <div className={'flex items-center justify-between mb-2'}>
                            <p className={'text-xs font-medium text-gray-300'}>{t('Permissions')}</p>
                            <div className={'flex gap-1'}>
                                {LEVELS.map((level) => (
                                    <button
                                        key={level.value}
                                        type={'button'}
                                        onClick={() => setAll(level.value)}
                                        className={
                                            'h-7 px-2 rounded-md text-2xs text-gray-400 hover:text-white hover:bg-white/5'
                                        }
                                    >
                                        {t('All {{value}}', { value: level.label.toLowerCase() })}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={'rounded-lg ring-1 ring-inset ring-gray-800 divide-y divide-gray-800'}>
                            {(data?.resources || []).map((resource) => (
                                <div
                                    key={resource}
                                    className={'flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5'}
                                >
                                    <span className={'flex-1 text-sm text-gray-200'}>{label(resource)}</span>
                                    <div
                                        className={
                                            'inline-flex p-0.5 rounded-lg bg-gray-950/60 ring-1 ring-inset ring-gray-800'
                                        }
                                    >
                                        {LEVELS.map((level) => (
                                            <button
                                                key={level.value}
                                                type={'button'}
                                                onClick={() =>
                                                    setPermissions({ ...permissions, [resource]: level.value })
                                                }
                                                className={classNames(
                                                    'h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
                                                    (permissions[resource] ?? 0) === level.value
                                                        ? level.value === 3
                                                            ? 'bg-amber-400 text-gray-950'
                                                            : level.value === 1
                                                            ? 'bg-sky-400 text-gray-950'
                                                            : 'bg-gray-700 text-white'
                                                        : 'text-gray-400 hover:text-gray-200'
                                                )}
                                            >
                                                {level.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Drawer>
            <Confirm
                open={!!revoking}
                title={t('Revoke this API key?')}
                confirm={t('Revoke')}
                loading={revoke.loading}
                onConfirm={() => revoking && revoke.run(revoking.identifier)}
                onClose={() => setRevoking(null)}
            >
                {t('Requests using')} <code>{revoking?.identifier}</code>{' '}
                {t('({{memo}}) will fail immediately.', { memo: revoking?.memo })}
            </Confirm>
        </Page>
    );
};
