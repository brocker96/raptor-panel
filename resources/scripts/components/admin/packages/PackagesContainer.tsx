import React, { useState } from 'react';
import classNames from 'classnames';
import {
    ArchiveIcon,
    ChipIcon,
    CubeIcon,
    DatabaseIcon,
    DocumentDuplicateIcon,
    PencilIcon,
    PlusIcon,
    ServerIcon,
    StatusOnlineIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    createPackage,
    deletePackage,
    duplicatePackage,
    getAvailability,
    getPackages,
    PackageValues,
    ServerPackage,
    toValues,
    updatePackage,
} from '@/api/raptor';
import { Page } from '@/components/admin/ui/Page';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { Badge, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { formatMb, useAction } from '@/components/admin/ui/hooks';
import PackageForm, { emptyPackage } from '@/components/admin/packages/PackageForm';
import { t } from '@/i18n';

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className={'min-w-0'}>
        <p className={'text-[0.65rem] uppercase tracking-wider text-gray-500'}>{label}</p>
        <p className={'mt-0.5 text-lg font-semibold text-gray-50 tabular-nums truncate'}>{value}</p>
    </div>
);

const PackageCard = ({ pkg, onEdit }: { pkg: ServerPackage; onEdit: () => void }) => {
    const [deleting, setDeleting] = useState(false);
    const [availability, setAvailability] = useState<boolean | null>(null);
    const invalidate = [['admin', 'packages']];
    const duplicate = useAction(duplicatePackage, { success: t('Package duplicated'), invalidate });
    const remove = useAction(deletePackage, { success: t('Package deleted'), invalidate });
    const check = useAction(getAvailability, { onSuccess: (r) => setAvailability(r.available) });

    return (
        <article
            className={classNames(
                'group relative flex flex-col rounded-xl bg-gray-900/70 ring-1 ring-inset p-5 shadow-card transition-colors',
                pkg.active ? 'ring-gray-800 hover:ring-raptor-500/40' : 'ring-gray-800/60 opacity-70'
            )}
        >
            <div className={'flex items-start gap-3'}>
                <span
                    className={
                        'grid place-items-center w-10 h-10 rounded-lg bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/20'
                    }
                >
                    <CubeIcon className={'w-5 h-5 text-raptor-400'} />
                </span>
                <div className={'flex-1 min-w-0'}>
                    <p className={'font-semibold text-gray-50 truncate'}>{pkg.name}</p>
                    <p className={'font-mono text-xs text-gray-500 truncate'}>{pkg.slug}</p>
                </div>
                {pkg.active ? (
                    <Badge tone={'green'}>{t('Active')}</Badge>
                ) : (
                    <Badge tone={'gray'}>{t('Inactive')}</Badge>
                )}
            </div>
            <p className={'mt-3 text-xs text-gray-400 truncate'}>{pkg.egg.name}</p>
            <div className={'mt-4 grid grid-cols-3 gap-3'}>
                <Stat label={t('Memory')} value={pkg.limits.memory ? formatMb(pkg.limits.memory) : '∞'} />
                <Stat label={t('Disk')} value={pkg.limits.disk ? formatMb(pkg.limits.disk) : '∞'} />
                <Stat label={t('CPU')} value={pkg.limits.cpu ? `${pkg.limits.cpu}%` : '∞'} />
            </div>
            <div className={'mt-4 flex flex-wrap gap-1.5 text-xs'}>
                <Badge tone={'gray'}>
                    <DatabaseIcon className={'w-3.5 h-3.5'} />
                    {t('Databases: {{count}}', { count: pkg.feature_limits.databases })}
                </Badge>
                <Badge tone={'gray'}>
                    <ChipIcon className={'w-3.5 h-3.5'} />
                    {t('Ports: {{count}}', { count: pkg.feature_limits.allocations + 1 })}
                </Badge>
                <Badge tone={'gray'}>
                    <ArchiveIcon className={'w-3.5 h-3.5'} />
                    {t('Backups: {{count}}', { count: pkg.feature_limits.backups })}
                </Badge>
            </div>
            <div className={'mt-5 pt-4 border-t border-gray-800 flex items-center gap-2'}>
                <span className={'flex-1 inline-flex items-center gap-1.5 text-xs text-gray-500'}>
                    <ServerIcon className={'w-4 h-4'} />
                    {t('Servers: {{count}}', { count: pkg.servers_count ?? 0 })}
                </span>
                {availability !== null && (
                    <Badge tone={availability ? 'green' : 'red'} dot>
                        {availability ? t('In stock') : t('Sold out')}
                    </Badge>
                )}
                <IconButton icon={StatusOnlineIcon} label={t('Check availability')} onClick={() => check.run(pkg.id)} />
                <IconButton icon={DocumentDuplicateIcon} label={t('Duplicate')} onClick={() => duplicate.run(pkg.id)} />
                <IconButton icon={PencilIcon} label={t('Edit')} onClick={onEdit} />
                <IconButton icon={TrashIcon} label={t('Delete')} tone={'danger'} onClick={() => setDeleting(true)} />
            </div>
            <Confirm
                open={deleting}
                title={t('Delete {{name}}?', { name: pkg.name })}
                confirm={t('Delete package')}
                loading={remove.loading}
                onClose={() => setDeleting(false)}
                onConfirm={() => remove.run(pkg.id).then(() => setDeleting(false))}
            >
                {t('Servers made from it keep running with their limits, they are just no longer linked to a package.')}
            </Confirm>
        </article>
    );
};

export default () => {
    const { data: packages } = useResource(['admin', 'packages'], (signal) => getPackages(signal));
    const [editing, setEditing] = useState<ServerPackage | null>(null);
    const [open, setOpen] = useState(false);
    const [values, setValues] = useState<PackageValues>(emptyPackage);

    const close = () => setOpen(false);
    const save = useAction((v: PackageValues) => (editing ? updatePackage(editing.id, v) : createPackage(v)), {
        success: (p) => (editing ? t('{{name}} saved', { name: p.name }) : t('{{name}} created', { name: p.name })),
        invalidate: [['admin', 'packages']],
        onSuccess: close,
    });

    const start = (pkg: ServerPackage | null) => {
        setEditing(pkg);
        setValues(pkg ? toValues(pkg) : emptyPackage);
        save.setErrors({});
        setOpen(true);
    };

    return (
        <Page
            title={t('Packages')}
            icon={CubeIcon}
            description={t(
                'Server plans for your shop. A billing system creates a complete server from a package with one API call.'
            )}
            actions={
                <Button icon={PlusIcon} onClick={() => start(null)}>
                    {t('New package')}
                </Button>
            }
        >
            {!packages ? (
                <div className={'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className={'h-64 rounded-xl'} />
                    ))}
                </div>
            ) : !packages.length ? (
                <div className={'rounded-xl bg-gray-900/70 ring-1 ring-inset ring-gray-800'}>
                    <EmptyState
                        icon={CubeIcon}
                        title={t('No packages yet')}
                        description={t(
                            'Create a package for every plan you sell: the game, its resources and where it runs.'
                        )}
                        action={
                            <Button icon={PlusIcon} onClick={() => start(null)}>
                                {t('New package')}
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className={'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
                    {packages.map((pkg) => (
                        <PackageCard key={pkg.id} pkg={pkg} onEdit={() => start(pkg)} />
                    ))}
                </div>
            )}
            <Drawer
                open={open}
                onClose={close}
                wide
                icon={CubeIcon}
                title={editing ? t('Edit {{name}}', { name: editing.name }) : t('New package')}
                description={t('Everything a new server gets, except its owner.')}
                footer={
                    <>
                        <Button variant={'secondary'} onClick={close}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={save.loading} onClick={() => save.run(values)}>
                            {editing ? t('Save') : t('Create package')}
                        </Button>
                    </>
                }
            >
                <PackageForm values={values} onChange={setValues} errors={save.errors} editing={!!editing} />
            </Drawer>
        </Page>
    );
};
