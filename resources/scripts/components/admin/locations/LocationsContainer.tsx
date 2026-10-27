import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GlobeIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { AdminLocation, createLocation, deleteLocation, getLocations, updateLocation } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { TextInput } from '@/components/admin/ui/Form';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { item } from '@/components/admin/ui/motion';
import { useAction } from '@/components/admin/ui/hooks';
import { t } from '@/i18n';

export default () => {
    const { data } = useResource(['admin', 'locations'], getLocations);
    const [editing, setEditing] = useState<AdminLocation | 'new' | null>(null);
    const [deleting, setDeleting] = useState<AdminLocation | null>(null);
    const [values, setValues] = useState({ short: '', long: '' });

    const open = (location: AdminLocation | 'new') => {
        setValues(location === 'new' ? { short: '', long: '' } : { short: location.short, long: location.long || '' });
        setEditing(location);
    };

    const save = useAction(
        () => (editing === 'new' ? createLocation(values) : updateLocation((editing as AdminLocation).id, values)),
        { success: t('Location saved'), invalidate: [['admin', 'locations']], onSuccess: () => setEditing(null) }
    );
    const remove = useAction((id: number) => deleteLocation(id), {
        success: t('Location deleted'),
        invalidate: [['admin', 'locations']],
        onSuccess: () => setDeleting(null),
    });

    return (
        <Page
            title={t('Locations')}
            icon={GlobeIcon}
            description={t('Group nodes by data center or region. Automatic deployment can target a location.')}
            guide={'locations'}
            actions={
                <Button icon={PlusIcon} onClick={() => open('new')}>
                    {t('New location')}
                </Button>
            }
        >
            {!data ? (
                <div className={'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className={'h-36 rounded-xl'} />
                    ))}
                </div>
            ) : data.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={GlobeIcon}
                        title={t('No locations yet')}
                        description={t('Every node belongs to a location, create one before adding your first node.')}
                        action={
                            <Button icon={PlusIcon} onClick={() => open('new')}>
                                {t('Create location')}
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <div className={'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
                    {data.map((location) => (
                        <div
                            key={location.id}
                            className={'rounded-xl p-4 bg-gray-900/70 ring-1 ring-inset ring-gray-800 shadow-card'}
                        >
                            <div className={'flex items-start gap-3'}>
                                <span
                                    className={
                                        'grid place-items-center w-10 h-10 rounded-lg bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/20 text-raptor-300 font-mono text-xs uppercase'
                                    }
                                >
                                    {location.short.slice(0, 3)}
                                </span>
                                <div className={'flex-1 min-w-0'}>
                                    <p className={'font-semibold text-gray-50 truncate'}>{location.short}</p>
                                    <p className={'text-xs text-gray-400 truncate'}>
                                        {location.long || t('No description')}
                                    </p>
                                </div>
                                <IconButton icon={PencilIcon} label={t('Edit')} onClick={() => open(location)} />
                                <IconButton
                                    icon={TrashIcon}
                                    label={location.nodes_count ? t('Remove the nodes first') : t('Delete')}
                                    tone={'danger'}
                                    disabled={location.nodes_count > 0}
                                    onClick={() => setDeleting(location)}
                                />
                            </div>
                            <div className={'mt-4 flex gap-4 text-xs text-gray-400'}>
                                <span>
                                    <span className={'text-gray-100 font-semibold'}>{location.nodes_count}</span>{' '}
                                    {t('nodes')}
                                </span>
                                <span>
                                    <span className={'text-gray-100 font-semibold'}>{location.servers_count}</span>{' '}
                                    {t('servers')}
                                </span>
                            </div>
                            {location.nodes.length > 0 && (
                                <div className={'mt-3 flex flex-wrap gap-1.5'}>
                                    {location.nodes.map((node) => (
                                        <Link
                                            key={node.id}
                                            to={`/admin/nodes/${node.id}`}
                                            className={
                                                'h-6 px-2 inline-flex items-center rounded-full bg-gray-800 text-xs text-gray-300 hover:text-white no-underline'
                                            }
                                        >
                                            {node.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <Drawer
                open={editing !== null}
                onClose={() => setEditing(null)}
                icon={GlobeIcon}
                title={editing === 'new' ? t('New location') : t('Edit location')}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setEditing(null)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={save.loading} onClick={() => save.run()}>
                            {t('Save')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={t('Short code')}
                        required
                        placeholder={'de-fra'}
                        value={values.short}
                        onChange={(short) => setValues({ ...values, short })}
                        error={save.errors.short}
                        description={t('A unique identifier, used by integrations and automatic deployment.')}
                    />
                    <TextInput
                        label={t('Description')}
                        placeholder={t('Frankfurt, Germany')}
                        value={values.long}
                        onChange={(long) => setValues({ ...values, long })}
                        error={save.errors.long}
                    />
                </div>
            </Drawer>
            <Confirm
                open={!!deleting}
                title={t('Delete {{short}}?', { short: deleting?.short })}
                confirm={t('Delete')}
                loading={remove.loading}
                onConfirm={() => deleting && remove.run(deleting.id)}
                onClose={() => setDeleting(null)}
            >
                {t('The location is removed. This does not affect any servers.')}
            </Confirm>
        </Page>
    );
};
