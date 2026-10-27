import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderIcon, PlusIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AdminMount, createMount, getMounts, MountValues } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Column, DataTable } from '@/components/admin/ui/DataTable';
import { Badge, EmptyState } from '@/components/admin/ui/Feedback';
import { Drawer } from '@/components/admin/ui/Overlay';
import Button from '@/components/admin/ui/Button';
import { useAction } from '@/components/admin/ui/hooks';
import MountForm, { emptyMount } from '@/components/admin/mounts/MountForm';
import { t } from '@/i18n';

const columns: Column<AdminMount>[] = [
    {
        key: 'name',
        header: t('Mount'),
        cell: (mount) => (
            <div className={'min-w-0'}>
                <p className={'font-medium text-gray-100 truncate'}>{mount.name}</p>
                <p className={'text-xs text-gray-500 font-mono truncate'}>
                    {mount.source} → {mount.target}
                </p>
            </div>
        ),
    },
    {
        key: 'flags',
        header: t('Options'),
        cell: (mount) => (
            <div className={'flex gap-1.5'}>
                {mount.read_only ? <Badge>{t('Read only')}</Badge> : <Badge tone={'yellow'}>{t('Writable')}</Badge>}
                {mount.user_mountable && <Badge tone={'blue'}>{t('User mountable')}</Badge>}
            </div>
        ),
        hideBelow: 'md',
    },
    {
        key: 'counts',
        header: t('Used by'),
        cell: (mount) => (
            <span className={'text-xs text-gray-400'}>
                {t('{{eggs}} eggs · {{nodes}} nodes · {{servers}} servers', {
                    eggs: mount.counts.eggs,
                    nodes: mount.counts.nodes,
                    servers: mount.counts.servers,
                })}
            </span>
        ),
    },
];

export default () => {
    const navigate = useNavigate();
    const { data } = useResource(['admin', 'mounts'], getMounts);
    const [creating, setCreating] = useState(false);
    const [values, setValues] = useState<MountValues>(emptyMount);

    const create = useAction(createMount, {
        success: t('Mount created, now link it to eggs and nodes'),
        invalidate: [['admin', 'mounts']],
        onSuccess: (mount) => navigate(`/admin/mounts/${mount.id}`),
    });

    return (
        <Page
            title={t('Mounts')}
            icon={FolderIcon}
            description={t('Share directories of a node with the servers running on it.')}
            guide={'mounts'}
            actions={
                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                    {t('New mount')}
                </Button>
            }
        >
            <Card flush>
                <DataTable
                    rows={data}
                    columns={columns}
                    rowKey={(mount) => mount.id}
                    onRowClick={(mount) => navigate(`/admin/mounts/${mount.id}`)}
                    empty={
                        <EmptyState
                            icon={FolderIcon}
                            title={t('No mounts')}
                            description={t(
                                'Mounts make a folder of the node, e.g. a shared map or mod cache, available inside servers.'
                            )}
                            action={
                                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                                    {t('Create mount')}
                                </Button>
                            }
                        />
                    }
                />
            </Card>
            <Drawer
                open={creating}
                onClose={() => setCreating(false)}
                icon={FolderIcon}
                title={t('New mount')}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setCreating(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run(values)}>
                            {t('Create mount')}
                        </Button>
                    </>
                }
            >
                <MountForm values={values} onChange={setValues} errors={create.errors} />
            </Drawer>
        </Page>
    );
};
