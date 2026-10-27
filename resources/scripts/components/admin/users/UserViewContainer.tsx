import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardListIcon, LockOpenIcon, ServerIcon, TrashIcon, UserIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { deleteUser, deleteUserAvatar, disableUserTwoFactor, getUser, updateUser, UserValues } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import { Badge, ServerStatusBadge, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import Button from '@/components/admin/ui/Button';
import { ago, useAction } from '@/components/admin/ui/hooks';
import UserForm from '@/components/admin/users/UserForm';
import { NotFound } from '@/components/elements/ScreenBlock';
import Avatar from '@/components/Avatar';
import { useStoreState } from '@/state/hooks';
import { t } from '@/i18n';

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const navigate = useNavigate();
    const self = useStoreState((state) => state.user.data!.uuid);
    const { data: user, error } = useResource(['admin', 'users', id], (signal) => getUser(id, signal));
    const [values, setValues] = useState<UserValues | null>(null);
    const [confirm, setConfirm] = useState<'delete' | '2fa' | null>(null);

    useEffect(() => {
        if (user) {
            setValues({
                email: user.email,
                username: user.username,
                name_first: user.name_first,
                name_last: user.name_last,
                password: '',
                language: user.language,
                root_admin: user.root_admin,
            });
        }
    }, [user]);

    const save = useAction((v: UserValues) => updateUser(id, v), {
        success: t('User updated'),
        invalidate: [['admin', 'users']],
    });
    const twoFactor = useAction(() => disableUserTwoFactor(id), {
        success: t('Two-factor authentication disabled'),
        invalidate: [['admin', 'users', id]],
        onSuccess: () => setConfirm(null),
    });
    const avatar = useAction(() => deleteUserAvatar(id), {
        success: t('Profile picture removed'),
        invalidate: [['admin', 'users']],
    });
    const remove = useAction(() => deleteUser(id), {
        success: t('User deleted'),
        invalidate: [['admin', 'users']],
        onSuccess: () => navigate('/admin/users'),
    });

    if (error) return <NotFound />;

    return (
        <Page
            title={user?.username || t('User')}
            icon={UserIcon}
            crumbs={[{ label: t('Users'), to: '/admin/users' }, { label: user?.email || '…' }]}
            description={
                user
                    ? t('Joined {{ago}} · last active {{ago2}}', {
                          ago: ago(user.created_at),
                          ago2: ago(user.last_activity),
                      })
                    : undefined
            }
            guide={'users'}
            actions={
                <Button variant={'secondary'} icon={ClipboardListIcon} to={`/admin/activity?actor=${id}`}>
                    {t('Activity')}
                </Button>
            }
        >
            {!user || !values ? (
                <Skeleton className={'h-80 rounded-xl'} />
            ) : (
                <div className={'grid gap-6 lg:grid-cols-3'}>
                    <div className={'lg:col-span-2 space-y-6'}>
                        <Card
                            title={t('Account details')}
                            footer={
                                <Button loading={save.loading} onClick={() => save.run(values)}>
                                    {t('Save changes')}
                                </Button>
                            }
                        >
                            <UserForm values={values} onChange={setValues} errors={save.errors} />
                        </Card>
                        <Card
                            title={t('Owned servers')}
                            description={t('{{count}} servers owned by this user.', { count: user.servers.length })}
                            flush
                            icon={ServerIcon}
                        >
                            <ul className={'divide-y divide-gray-800'}>
                                {user.servers.map((server) => (
                                    <li key={server.id}>
                                        <Link
                                            to={`/admin/servers/${server.id}`}
                                            className={
                                                'flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] no-underline'
                                            }
                                        >
                                            <span className={'flex-1 min-w-0'}>
                                                <span
                                                    className={'block text-sm text-gray-100 truncate'}
                                                    title={server.name}
                                                >
                                                    {server.name}
                                                </span>
                                                <span className={'block text-xs text-gray-500 truncate'}>
                                                    {server.identifier} · {server.node}
                                                </span>
                                            </span>
                                            <ServerStatusBadge status={server.status} />
                                        </Link>
                                    </li>
                                ))}
                                {!user.servers.length && (
                                    <li className={'px-5 pb-5 text-sm text-gray-500'}>
                                        {t('This user does not own any servers.')}
                                    </li>
                                )}
                            </ul>
                        </Card>
                        {user.subuser_of.length > 0 && (
                            <Card title={t('Subuser on')} flush>
                                <ul className={'divide-y divide-gray-800'}>
                                    {user.subuser_of.map((server) => (
                                        <li key={server.id}>
                                            <Link
                                                to={`/admin/servers/${server.id}`}
                                                className={
                                                    'block px-5 py-3 text-sm text-gray-200 hover:bg-white/[0.03] no-underline'
                                                }
                                            >
                                                {server.name}{' '}
                                                <span className={'text-gray-500'}>· {server.identifier}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </div>
                    <div className={'space-y-6'}>
                        <Card title={t('Summary')}>
                            <div className={'flex items-center gap-4 mb-5'}>
                                <span
                                    className={
                                        'w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0'
                                    }
                                >
                                    <Avatar name={user.username} seed={user.uuid} src={user.avatar} />
                                </span>
                                <div className={'min-w-0'}>
                                    <p className={'text-sm font-medium text-gray-100 truncate'}>
                                        {user.name || user.username}
                                    </p>
                                    <p className={'text-xs text-gray-500'}>
                                        {user.avatar ? t('Uploaded profile picture') : t('Generated avatar')}
                                    </p>
                                    {user.avatar && (
                                        <Button
                                            size={'sm'}
                                            variant={'ghost'}
                                            className={'mt-1 -ml-3'}
                                            loading={avatar.loading}
                                            onClick={() => avatar.run()}
                                        >
                                            {t('Remove picture')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <Details
                                items={[
                                    [t('ID'), user.id],
                                    [
                                        t('UUID'),
                                        <code key={'uuid'} className={'text-xs break-all'}>
                                            {user.uuid}
                                        </code>,
                                    ],
                                    [t('External ID'), user.external_id],
                                    [t('Language'), user.language],
                                    [
                                        t('Role'),
                                        user.root_admin ? (
                                            <Badge key={'r'} tone={'green'}>
                                                {t('Administrator')}
                                            </Badge>
                                        ) : (
                                            t('User')
                                        ),
                                    ],
                                    [
                                        t('Two-factor'),
                                        user['2fa'] ? (
                                            <Badge key={'t'} tone={'blue'}>
                                                {t('Enabled')}
                                            </Badge>
                                        ) : (
                                            t('Disabled')
                                        ),
                                    ],
                                ]}
                            />
                        </Card>
                        <Card
                            title={t('Two-factor authentication')}
                            icon={LockOpenIcon}
                            description={t('Disable 2FA when the user lost access to their authenticator app.')}
                        >
                            <Button
                                variant={'secondary'}
                                disabled={!user['2fa']}
                                onClick={() => setConfirm('2fa')}
                                className={'w-full'}
                            >
                                {user['2fa'] ? t('Disable 2FA') : t('2FA is not enabled')}
                            </Button>
                        </Card>
                        <Card
                            title={t('Delete user')}
                            danger
                            icon={TrashIcon}
                            description={t('Users that own servers cannot be deleted.')}
                        >
                            <Button
                                variant={'danger'}
                                className={'w-full'}
                                disabled={user.servers.length > 0 || user.uuid === self}
                                onClick={() => setConfirm('delete')}
                            >
                                {t('Delete user')}
                            </Button>
                        </Card>
                    </div>
                </div>
            )}
            <Confirm
                open={confirm === '2fa'}
                title={t('Disable two-factor authentication?')}
                confirm={t('Disable 2FA')}
                loading={twoFactor.loading}
                onConfirm={() => twoFactor.run()}
                onClose={() => setConfirm(null)}
            >
                {t('{{username}} will be able to log in with only their password until they set up 2FA again.', {
                    username: user?.username,
                })}
            </Confirm>
            <Confirm
                open={confirm === 'delete'}
                title={t('Delete this user?')}
                confirm={t('Delete user')}
                challenge={user?.username}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setConfirm(null)}
            >
                {t(
                    'The account, its API keys and SSH keys are removed permanently. Subuser access to other servers is revoked.'
                )}
            </Confirm>
        </Page>
    );
};
