import React, { useState } from 'react';
import classNames from 'classnames';
import { DesktopComputerIcon, LogoutIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { ago, useAction } from '@/components/admin/ui/hooks';
import {
    forgetTrustedDevice,
    forgetTrustedDevices,
    revokeOtherSessions,
    revokeSession,
    SecurityOverview,
    SecuritySession,
} from '@/api/account/security';
import { deviceLabel, DeviceIcon, formatDate, methodLabel } from '@/components/dashboard/security/helpers';
import { t } from '@/i18n';

export const SessionsCard = ({ data, refresh }: { data: SecurityOverview; refresh: () => void }) => {
    const [ending, setEnding] = useState<SecuritySession | null>(null);
    const [endingOthers, setEndingOthers] = useState(false);
    const others = data.sessions.filter((session) => !session.current).length;

    const end = useAction((session: SecuritySession) => revokeSession(session.identifier), {
        success: t('Session ended'),
        onSuccess: () => {
            setEnding(null);
            refresh();
        },
    });
    const endOthers = useAction(revokeOtherSessions, {
        success: (count) => t('{{count}} sessions ended', { count }),
        onSuccess: () => {
            setEndingOthers(false);
            refresh();
        },
    });

    return (
        <Card
            flush
            icon={DesktopComputerIcon}
            title={t('Where you are signed in')}
            description={
                data.policy.idleTimeout
                    ? t('Sessions end after {{days}} days, or after {{minutes}} minutes without activity.', {
                          days: data.policy.sessionDays,
                          minutes: data.policy.idleTimeout,
                      })
                    : t('Devices stay signed in for {{days}} days when "Keep me signed in" was chosen.', {
                          days: data.policy.sessionDays,
                      })
            }
            actions={
                others > 0 ? (
                    <Button size={'sm'} variant={'danger'} icon={LogoutIcon} onClick={() => setEndingOthers(true)}>
                        {t('Sign out others')}
                    </Button>
                ) : undefined
            }
        >
            <ul className={'divide-y divide-gray-800'}>
                {data.sessions.map((session) => (
                    <li key={session.identifier} className={'flex items-center gap-3 px-4 sm:px-5 py-3'}>
                        <span
                            className={classNames(
                                'grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl ring-1 ring-inset',
                                session.current
                                    ? 'bg-raptor-500/10 text-raptor-400 ring-raptor-500/25'
                                    : 'bg-gray-800/70 text-gray-300 ring-gray-700/60'
                            )}
                        >
                            <DeviceIcon type={session.type} className={'w-5 h-5'} />
                        </span>
                        <div className={'min-w-0 flex-1'}>
                            <div className={'flex flex-wrap items-center gap-x-2 gap-y-1'}>
                                <p className={'text-sm text-gray-100 break-words'}>{deviceLabel(session)}</p>
                                {session.current && (
                                    <Badge tone={'green'} dot>
                                        {t('This device')}
                                    </Badge>
                                )}
                            </div>
                            <p className={'text-xs text-gray-500 break-words'} title={formatDate(session.createdAt)}>
                                <span className={'font-mono'}>{session.ip}</span>
                                {' · '}
                                {session.current
                                    ? t('active now')
                                    : t('active {{date}}', { date: ago(session.lastActiveAt) })}
                                {' · '}
                                {methodLabel(session.method)}
                            </p>
                        </div>
                        {!session.current && (
                            <Button
                                variant={'ghost'}
                                size={'sm'}
                                icon={LogoutIcon}
                                title={t('Sign out')}
                                aria-label={t('Sign out')}
                                onClick={() => setEnding(session)}
                            />
                        )}
                    </li>
                ))}
            </ul>

            <Confirm
                open={!!ending}
                title={t('Sign out this device?')}
                confirm={t('Sign out')}
                loading={end.loading}
                onConfirm={() => ending && end.run(ending)}
                onClose={() => setEnding(null)}
            >
                {ending &&
                    t('{{device}} ({{ip}}) is signed out on its next request.', {
                        device: deviceLabel(ending),
                        ip: ending.ip,
                    })}
            </Confirm>
            <Confirm
                open={endingOthers}
                title={t('Sign out all other devices?')}
                confirm={t('Sign out others')}
                loading={endOthers.loading}
                onConfirm={() => endOthers.run()}
                onClose={() => setEndingOthers(false)}
            >
                {t(
                    'Every browser except this one is signed out. Do this when you think someone else used your account, and change your password as well.'
                )}
            </Confirm>
        </Card>
    );
};

export const TrustedDevicesCard = ({ data, refresh }: { data: SecurityOverview; refresh: () => void }) => {
    const forget = useAction((id: number) => forgetTrustedDevice(id), {
        success: t('Device forgotten'),
        onSuccess: refresh,
    });
    const forgetAll = useAction(forgetTrustedDevices, { success: t('All devices forgotten'), onSuccess: refresh });

    if (!data.policy.trustedDeviceDays || (!data.twoFactor.enabled && data.trustedDevices.length === 0)) return null;

    return (
        <Card
            flush
            icon={ShieldCheckIcon}
            title={t('Trusted devices')}
            description={t(
                'These browsers skip the two-step code for {{days}} days after you chose "Trust this device".',
                {
                    days: data.policy.trustedDeviceDays,
                }
            )}
            actions={
                data.trustedDevices.length > 1 ? (
                    <Button size={'sm'} variant={'ghost'} loading={forgetAll.loading} onClick={() => forgetAll.run()}>
                        {t('Forget all')}
                    </Button>
                ) : undefined
            }
        >
            {data.trustedDevices.length === 0 ? (
                <p className={'px-4 sm:px-5 pb-5 text-sm text-gray-500'}>{t('No trusted devices.')}</p>
            ) : (
                <ul className={'divide-y divide-gray-800'}>
                    {data.trustedDevices.map((device) => (
                        <li key={device.id} className={'flex items-center gap-3 px-4 sm:px-5 py-3'}>
                            <span
                                className={
                                    'grid place-items-center w-9 h-9 flex-shrink-0 rounded-lg bg-gray-800 text-gray-300'
                                }
                            >
                                <DeviceIcon type={device.type} className={'w-4 h-4'} />
                            </span>
                            <div className={'min-w-0 flex-1'}>
                                <p className={'text-sm text-gray-100 break-words'}>{deviceLabel(device)}</p>
                                <p className={'text-xs text-gray-500'}>
                                    <span className={'font-mono'}>{device.ip}</span>
                                    {' · '}
                                    {t('trusted until {{date}}', { date: formatDate(device.expiresAt) })}
                                </p>
                            </div>
                            <Button
                                variant={'ghost'}
                                size={'sm'}
                                icon={TrashIcon}
                                title={t('Forget')}
                                aria-label={t('Forget')}
                                onClick={() => forget.run(device.id)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
};
