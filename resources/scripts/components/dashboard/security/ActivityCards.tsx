import React from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, ClockIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import { Badge } from '@/components/admin/ui/Feedback';
import { Toggle } from '@/components/admin/ui/Form';
import { ago, useAction } from '@/components/admin/ui/hooks';
import { SecurityOverview, updateSecurityPreferences } from '@/api/account/security';
import { deviceLabel, formatDate, loginEventLabel } from '@/components/dashboard/security/helpers';
import { t } from '@/i18n';

export const LoginHistoryCard = ({ data }: { data: SecurityOverview }) => (
    <Card
        flush
        icon={ClockIcon}
        title={t('Recent sign-ins')}
        description={t('Successful and failed attempts to sign in to your account.')}
        footer={
            <Link to={'/account/activity'} className={'text-xs font-medium text-raptor-400 hover:text-raptor-300'}>
                {t('View all account activity')}
            </Link>
        }
    >
        {data.logins.length === 0 ? (
            <p className={'px-4 sm:px-5 pb-5 text-sm text-gray-500'}>{t('No sign-ins recorded yet.')}</p>
        ) : (
            <ul className={'divide-y divide-gray-800'}>
                {data.logins.map((login, index) => {
                    const { label, tone } = loginEventLabel(login.event);

                    return (
                        <li key={index} className={'px-4 sm:px-5 py-2.5'}>
                            <div className={'flex items-center justify-between gap-3'}>
                                <Badge tone={tone} dot>
                                    {label}
                                </Badge>
                                <time
                                    className={'text-xs text-gray-500 whitespace-nowrap'}
                                    title={formatDate(login.timestamp)}
                                >
                                    {ago(login.timestamp)}
                                </time>
                            </div>
                            <p className={'mt-1 text-xs text-gray-400 break-words'}>
                                {deviceLabel(login)}
                                {login.ip && (
                                    <>
                                        {' · '}
                                        <span className={'font-mono'}>{login.ip}</span>
                                    </>
                                )}
                            </p>
                        </li>
                    );
                })}
            </ul>
        )}
    </Card>
);

export const AlertsCard = ({ data, refresh }: { data: SecurityOverview; refresh: () => void }) => {
    const update = useAction((value: boolean) => updateSecurityPreferences({ security_alerts: value }), {
        success: t('Notification settings saved'),
        onSuccess: refresh,
    });

    return (
        <Card
            icon={BellIcon}
            title={t('Security alerts')}
            description={t('E-mails about important events on your account.')}
        >
            <div className={'space-y-3'}>
                <Toggle
                    label={t('E-mail me about sign-ins from new devices')}
                    description={t(
                        'You get an e-mail with the device and IP address whenever your account is used on a browser it was not used on before.'
                    )}
                    checked={data.alerts}
                    disabled={update.loading}
                    onChange={(value) => update.run(value)}
                />
                <p className={'text-xs text-gray-500 leading-relaxed'}>
                    {t(
                        'Changes to your password, e-mail address, two-step verification, passkeys and PIN are always reported.'
                    )}
                </p>
            </div>
        </Card>
    );
};
