import React, { useState } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { ago, useAction } from '@/components/admin/ui/hooks';
import { AdminUserDetails, deleteUserPasskeys, resetUserPin, revokeUserSessions, unlockUser } from '@/api/admin';
import { deviceLabel, DeviceIcon } from '@/components/dashboard/security/helpers';
import { t } from '@/i18n';

type Action = 'sessions' | 'pin' | 'passkeys' | null;

/**
 * Security state of a user and the actions an administrator needs when an account was lost or
 * may be compromised.
 */
const UserSecurityCard = ({ user, onDisableTwoFactor }: { user: AdminUserDetails; onDisableTwoFactor: () => void }) => {
    const [confirm, setConfirm] = useState<Action>(null);
    const invalidate = [['admin', 'users', user.id]];
    const done = { invalidate, onSuccess: () => setConfirm(null) };

    const sessions = useAction(() => revokeUserSessions(user.id), {
        ...done,
        success: (count: number) => t('{{count}} sessions ended', { count }),
    });
    const pin = useAction(() => resetUserPin(user.id), { ...done, success: t('PIN removed') });
    const passkeys = useAction(() => deleteUserPasskeys(user.id), { ...done, success: t('Passkeys removed') });
    const unlock = useAction(() => unlockUser(user.id), { invalidate, success: t('Account unlocked') });

    const { security } = user;

    return (
        <Card
            title={t('Account security')}
            icon={ShieldCheckIcon}
            description={t('Help a user that lost a device, or sign out an account that may be compromised.')}
        >
            <div className={'space-y-4'}>
                {security.locked_until && (
                    <Callout tone={'yellow'} title={t('Locked after failed sign-ins')}>
                        <p>{t('The account unlocks {{date}}.', { date: ago(security.locked_until) })}</p>
                        <Button
                            size={'sm'}
                            variant={'secondary'}
                            className={'mt-2'}
                            loading={unlock.loading}
                            onClick={() => unlock.run()}
                        >
                            {t('Unlock now')}
                        </Button>
                    </Callout>
                )}
                <div className={'flex flex-wrap gap-1.5'}>
                    <Badge tone={user['2fa'] ? 'green' : 'gray'} dot>
                        {user['2fa'] ? t('Two-step on') : t('Two-step off')}
                    </Badge>
                    <Badge tone={security.passkeys ? 'green' : 'gray'} dot>
                        {t('{{count}} passkeys', { count: security.passkeys })}
                    </Badge>
                    <Badge tone={security.pin ? 'green' : 'gray'} dot>
                        {security.pin ? t('PIN set') : t('No PIN')}
                    </Badge>
                </div>

                <div>
                    <p className={'text-2xs uppercase tracking-wider text-gray-500 mb-2'}>
                        {t('Active sessions ({{count}})', { count: security.sessions.length })}
                    </p>
                    {security.sessions.length === 0 ? (
                        <p className={'text-sm text-gray-500'}>{t('Not signed in anywhere.')}</p>
                    ) : (
                        <ul className={'space-y-2'}>
                            {security.sessions.slice(0, 5).map((session) => (
                                <li key={session.identifier} className={'flex items-center gap-2.5 min-w-0'}>
                                    <DeviceIcon type={session.type} className={'w-4 h-4 flex-shrink-0 text-gray-400'} />
                                    <span className={'min-w-0 text-xs text-gray-300 break-words'}>
                                        {deviceLabel(session)}
                                        <span className={'text-gray-500'}>
                                            {' · '}
                                            <span className={'font-mono'}>{session.ip}</span>
                                            {' · '}
                                            {ago(session.last_active_at)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                            {security.sessions.length > 5 && (
                                <li className={'text-xs text-gray-500'}>
                                    {t('and {{count}} more', { count: security.sessions.length - 5 })}
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                <div className={'grid gap-2'}>
                    <Button
                        variant={'secondary'}
                        disabled={!security.sessions.length}
                        onClick={() => setConfirm('sessions')}
                    >
                        {t('Sign out everywhere')}
                    </Button>
                    <Button variant={'secondary'} disabled={!user['2fa']} onClick={onDisableTwoFactor}>
                        {user['2fa'] ? t('Disable 2FA') : t('2FA is not enabled')}
                    </Button>
                    <div className={'grid grid-cols-2 gap-2'}>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            disabled={!security.pin}
                            onClick={() => setConfirm('pin')}
                        >
                            {t('Reset PIN')}
                        </Button>
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            disabled={!security.passkeys}
                            onClick={() => setConfirm('passkeys')}
                        >
                            {t('Remove passkeys')}
                        </Button>
                    </div>
                </div>
            </div>

            <Confirm
                open={confirm === 'sessions'}
                title={t('Sign {{username}} out everywhere?', { username: user.username })}
                confirm={t('Sign out everywhere')}
                loading={sessions.loading}
                onConfirm={() => sessions.run()}
                onClose={() => setConfirm(null)}
            >
                {t(
                    'Every browser of this user is signed out on its next request. Change the password as well if the account may be compromised.'
                )}
            </Confirm>
            <Confirm
                open={confirm === 'pin'}
                title={t('Reset the PIN?')}
                confirm={t('Reset PIN')}
                loading={pin.loading}
                onConfirm={() => pin.run()}
                onClose={() => setConfirm(null)}
            >
                {t('The user confirms actions and unlocks the panel with their password until they set a new PIN.')}
            </Confirm>
            <Confirm
                open={confirm === 'passkeys'}
                title={t('Remove all passkeys?')}
                confirm={t('Remove passkeys')}
                loading={passkeys.loading}
                onConfirm={() => passkeys.run()}
                onClose={() => setConfirm(null)}
            >
                {t(
                    'The passkeys and trusted devices of this user stop working. Use this when a device with a passkey was lost or stolen.'
                )}
            </Confirm>
        </Card>
    );
};

export default UserSecurityCard;
