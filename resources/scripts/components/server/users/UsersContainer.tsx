import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { PencilIcon, TrashIcon, UserAddIcon, UsersIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { useStoreActions, useStoreState } from '@/state/hooks';
import getServerSubusers from '@/api/server/users/getServerSubusers';
import deleteSubuser from '@/api/server/users/deleteSubuser';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { ago } from '@/components/admin/ui/hooks';
import Avatar from '@/components/Avatar';
import { usePermissions } from '@/plugins/usePermissions';
import { httpErrorToHuman } from '@/api/http';
import { Subuser } from '@/state/server/subusers';
import SubuserEditor from '@/components/server/users/SubuserEditor';
import { matchPreset, permissionGroups } from '@/components/server/users/permissionCatalog';
import { t } from '@/i18n';

const SubuserCard = ({
    subuser,
    self,
    canEdit,
    canDelete,
    onEdit,
    onDelete,
}: {
    subuser: Subuser;
    self: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) => {
    const groups = permissionGroups();
    const all = groups.flatMap((group) => group.permissions.map((p) => p.key));
    const permissions = subuser.permissions.filter((key) => key !== 'websocket.connect') as string[];
    const role = matchPreset(permissions, all);

    return (
        <li className={'flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4'}>
            <div className={'flex items-center gap-3 min-w-0 flex-1'}>
                <span className={'w-10 h-10 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-white/10'}>
                    <Avatar name={subuser.username} seed={subuser.uuid} src={subuser.avatarUrl} />
                </span>
                <div className={'min-w-0'}>
                    <p className={'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-100'}>
                        <span className={'break-all'}>{subuser.email}</span>
                        {self && <Badge tone={'blue'}>{t('You')}</Badge>}
                    </p>
                    <p className={'mt-0.5 text-xs text-gray-500'}>
                        {subuser.username} · {t('added {{date}}', { date: ago(subuser.createdAt.toISOString()) })}
                    </p>
                </div>
            </div>
            <div className={'flex flex-wrap items-center gap-1.5 sm:justify-end'}>
                <Badge tone={role?.key === 'admin' ? 'green' : 'gray'}>
                    {role ? role.label : t('Custom · {{count}}', { count: permissions.length })}
                </Badge>
                <Badge tone={subuser.twoFactorEnabled ? 'green' : 'yellow'} dot>
                    {subuser.twoFactorEnabled ? t('2FA') : t('No 2FA')}
                </Badge>
                <span className={'hidden md:flex items-center gap-1 ml-1'}>
                    {groups.map((group) => {
                        const Icon = group.icon;
                        const active = group.permissions.some((p) => permissions.includes(p.key));

                        return (
                            <span key={group.key} title={group.label}>
                                <Icon className={classNames('w-4 h-4', active ? 'text-raptor-400' : 'text-gray-700')} />
                            </span>
                        );
                    })}
                </span>
            </div>
            {!self && (canEdit || canDelete) && (
                <div className={'flex gap-1 sm:ml-2'}>
                    <Button variant={'secondary'} size={'sm'} icon={PencilIcon} onClick={onEdit} className={'flex-1'}>
                        {canEdit ? t('Edit') : t('View')}
                    </Button>
                    {canDelete && (
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={TrashIcon}
                            aria-label={t('Remove')}
                            title={t('Remove')}
                            onClick={onDelete}
                        />
                    )}
                </div>
            )}
        </li>
    );
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const subusers = ServerContext.useStoreState((state) => state.subusers.data);
    const setSubusers = ServerContext.useStoreActions((actions) => actions.subusers.setSubusers);
    const removeSubuser = ServerContext.useStoreActions((actions) => actions.subusers.removeSubuser);
    const self = useStoreState((state) => state.user.data!.uuid);
    const permissions = useStoreState((state) => state.permissions.data);
    const getPermissions = useStoreActions((actions) => actions.permissions.getPermissions);
    const [canCreate, canEdit, canDelete] = usePermissions(['user.create', 'user.update', 'user.delete']);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Subuser | 'new' | null>(null);
    const [removing, setRemoving] = useState<Subuser | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        getServerSubusers(uuid)
            .then(setSubusers)
            .catch((err) => setError(httpErrorToHuman(err)))
            .then(() => setLoading(false));
        getPermissions().catch((err) => setError(httpErrorToHuman(err)));
    }, []);

    const sorted = useMemo(() => [...subusers].sort((a, b) => a.email.localeCompare(b.email)), [subusers]);

    const remove = async () => {
        if (!removing) return;
        setDeleting(true);
        try {
            await deleteSubuser(uuid, removing.uuid);
            removeSubuser(removing.uuid);
            toast.success(t('Access removed'), removing.email);
            setRemoving(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setDeleting(false);
        }
    };

    const ready = !loading && Object.keys(permissions).length > 0;

    return (
        <ServerContentBlock
            title={t('Users')}
            icon={UsersIcon}
            description={t(
                'Give friends, moderators or developers access to this server, each with exactly the permissions they need.'
            )}
            actions={
                canCreate && ready ? (
                    <Button icon={UserAddIcon} onClick={() => setEditing('new')}>
                        {t('Invite a user')}
                    </Button>
                ) : undefined
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{error}</Callout>
                </div>
            )}

            {!ready ? (
                <Skeleton className={'h-48 rounded-xl'} />
            ) : sorted.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={UsersIcon}
                        title={t('Nobody else has access yet')}
                        description={t(
                            'Invite someone by e-mail and choose a role such as Viewer, Operator or Developer. They never get your password.'
                        )}
                        action={
                            canCreate ? (
                                <Button icon={UserAddIcon} onClick={() => setEditing('new')}>
                                    {t('Invite a user')}
                                </Button>
                            ) : undefined
                        }
                    />
                </Card>
            ) : (
                <Card flush title={t('{{count}} users with access', { count: sorted.length })}>
                    <ul className={'divide-y divide-gray-800'}>
                        {sorted.map((subuser) => (
                            <SubuserCard
                                key={subuser.uuid}
                                subuser={subuser}
                                self={subuser.uuid === self}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                onEdit={() => setEditing(subuser)}
                                onDelete={() => setRemoving(subuser)}
                            />
                        ))}
                    </ul>
                </Card>
            )}

            <SubuserEditor
                open={editing !== null}
                subuser={editing && editing !== 'new' ? editing : undefined}
                readOnly={editing !== 'new' && !canEdit}
                onClose={() => setEditing(null)}
            />
            <Confirm
                open={!!removing}
                title={t('Remove {{email}}?', { email: removing?.email })}
                confirm={t('Remove access')}
                loading={deleting}
                onConfirm={remove}
                onClose={() => setRemoving(null)}
            >
                {t('They lose access to this server immediately, including SFTP. Their account itself is not deleted.')}
            </Confirm>
        </ServerContentBlock>
    );
};
