import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CollectionIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AdminNest, createNest, deleteNest, getNests, importEgg, updateNest } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Badge, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Card } from '@/components/admin/ui/Card';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { TextArea, TextInput } from '@/components/admin/ui/Form';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { SearchInput } from '@/components/admin/ui/DataTable';
import { item } from '@/components/admin/ui/motion';
import { useAction } from '@/components/admin/ui/hooks';

export default () => {
    const navigate = useNavigate();
    const { data } = useResource(['admin', 'nests'], getNests);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<AdminNest | 'new' | null>(null);
    const [deleting, setDeleting] = useState<AdminNest | null>(null);
    const [values, setValues] = useState({ name: '', description: '' });
    const fileInput = useRef<HTMLInputElement>(null);
    const [importTarget, setImportTarget] = useState<number | null>(null);

    const save = useAction(
        () => (editing === 'new' ? createNest(values) : updateNest((editing as AdminNest).id, values)),
        {
            success: 'Nest saved',
            invalidate: [['admin', 'nests']],
            onSuccess: () => setEditing(null),
        }
    );
    const remove = useAction((id: number) => deleteNest(id), {
        success: 'Nest deleted',
        invalidate: [['admin', 'nests']],
        onSuccess: () => setDeleting(null),
    });
    const upload = useAction((nest: number, file: File) => importEgg(nest, file), {
        success: (egg) => `Imported ${egg.name}`,
        invalidate: [['admin', 'nests']],
        onSuccess: (egg) => navigate(`/admin/nests/eggs/${egg.id}`),
    });

    const open = (nest: AdminNest | 'new') => {
        setValues(
            nest === 'new' ? { name: '', description: '' } : { name: nest.name, description: nest.description || '' }
        );
        setEditing(nest);
    };

    const term = search.toLowerCase();
    const nests = (data || [])
        .map((nest) => ({
            ...nest,
            eggs: nest.eggs.filter(
                (egg) => !term || egg.name.toLowerCase().includes(term) || nest.name.toLowerCase().includes(term)
            ),
        }))
        .filter((nest) => !term || nest.eggs.length > 0 || nest.name.toLowerCase().includes(term));

    return (
        <Page
            title={'Nests & eggs'}
            icon={CollectionIcon}
            description={'Eggs describe how a type of server is installed and started. Nests group them.'}
            guide={'nests-eggs'}
            actions={
                <Button icon={PlusIcon} onClick={() => open('new')}>
                    New nest
                </Button>
            }
        >
            <input
                ref={fileInput}
                type={'file'}
                accept={'application/json,.json'}
                className={'hidden'}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && importTarget) upload.run(importTarget, file);
                    e.target.value = '';
                }}
            />
            <div>
                <SearchInput value={search} onChange={setSearch} placeholder={'Search eggs…'} className={'max-w-md'} />
            </div>
            {!data ? (
                <Skeleton className={'h-64 rounded-xl'} />
            ) : nests.length === 0 ? (
                <Card>
                    <EmptyState icon={CollectionIcon} title={'Nothing found'} />
                </Card>
            ) : (
                nests.map((nest) => (
                    <Card
                        key={nest.id}
                        title={nest.name}
                        description={nest.description || `${nest.eggs.length} eggs · ${nest.servers} servers`}
                        icon={CollectionIcon}
                        flush
                        actions={
                            <>
                                <Button
                                    size={'sm'}
                                    variant={'secondary'}
                                    icon={UploadIcon}
                                    loading={upload.loading && importTarget === nest.id}
                                    onClick={() => {
                                        setImportTarget(nest.id);
                                        fileInput.current?.click();
                                    }}
                                >
                                    <span className={'hidden sm:inline'}>Import egg</span>
                                </Button>
                                <Button
                                    size={'sm'}
                                    variant={'secondary'}
                                    icon={PlusIcon}
                                    to={`/admin/nests/eggs/new?nest=${nest.id}`}
                                >
                                    <span className={'hidden sm:inline'}>New egg</span>
                                </Button>
                                <IconButton icon={PencilIcon} label={'Edit nest'} onClick={() => open(nest)} />
                                <IconButton
                                    icon={TrashIcon}
                                    label={'Delete nest'}
                                    tone={'danger'}
                                    disabled={nest.servers > 0}
                                    onClick={() => setDeleting(nest)}
                                />
                            </>
                        }
                    >
                        <div
                            className={'grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-gray-800 border-t border-gray-800'}
                        >
                            {nest.eggs.map((egg) => (
                                <Link
                                    key={egg.id}
                                    to={`/admin/nests/eggs/${egg.id}`}
                                    className={
                                        'group block p-4 bg-gray-900 hover:bg-gray-900/40 no-underline transition-colors'
                                    }
                                >
                                    <div className={'flex items-start gap-2'}>
                                        <p
                                            className={
                                                'flex-1 text-sm font-medium text-gray-100 group-hover:text-white truncate'
                                            }
                                        >
                                            {egg.name}
                                        </p>
                                        <Badge tone={egg.servers ? 'green' : 'gray'}>{egg.servers}</Badge>
                                    </div>
                                    <p className={'mt-1 text-xs text-gray-500 line-clamp-2'}>
                                        {egg.description || 'No description'}
                                    </p>
                                    <p className={'mt-2 text-2xs text-gray-600 truncate'}>
                                        {Object.keys(egg.docker_images).join(' · ')}
                                    </p>
                                </Link>
                            ))}
                            {nest.eggs.length === 0 && (
                                <p className={'p-4 bg-gray-900 text-sm text-gray-500 sm:col-span-2 xl:col-span-3'}>
                                    No eggs in this nest yet.
                                </p>
                            )}
                        </div>
                    </Card>
                ))
            )}
            <Drawer
                open={editing !== null}
                onClose={() => setEditing(null)}
                icon={CollectionIcon}
                title={editing === 'new' ? 'New nest' : 'Edit nest'}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                        <Button loading={save.loading} onClick={() => save.run()}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={'Name'}
                        required
                        value={values.name}
                        onChange={(name) => setValues({ ...values, name })}
                        error={save.errors.name}
                        placeholder={'Minecraft'}
                    />
                    <TextArea
                        label={'Description'}
                        value={values.description}
                        onChange={(description) => setValues({ ...values, description })}
                        rows={3}
                    />
                </div>
            </Drawer>
            <Confirm
                open={!!deleting}
                title={`Delete ${deleting?.name}?`}
                confirm={'Delete'}
                loading={remove.loading}
                onConfirm={() => deleting && remove.run(deleting.id)}
                onClose={() => setDeleting(null)}
            >
                The nest and all {deleting?.eggs.length} eggs in it are deleted.
            </Confirm>
        </Page>
    );
};
