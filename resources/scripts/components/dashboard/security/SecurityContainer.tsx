import React from 'react';
import { useLocation } from 'react-router-dom';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { Toaster } from '@/components/admin/ui/Toast';
import { useResource } from '@/api/query';
import { getSecurityOverview } from '@/api/account/security';
import SecurityScore from '@/components/dashboard/security/SecurityScore';
import TwoFactorCard from '@/components/dashboard/security/TwoFactorCard';
import PasskeysCard from '@/components/dashboard/security/PasskeysCard';
import PinCard from '@/components/dashboard/security/PinCard';
import { SessionsCard, TrustedDevicesCard } from '@/components/dashboard/security/SessionsCard';
import { AlertsCard, LoginHistoryCard } from '@/components/dashboard/security/ActivityCards';
import { t } from '@/i18n';

const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div id={`security-${id}`} className={'scroll-mt-24'}>
        {children}
    </div>
);

export default () => {
    const state = useLocation().state as { twoFactorRedirect?: boolean } | null;
    const { data, error, mutate } = useResource(['account', 'security'], getSecurityOverview);
    const refresh = () => {
        mutate();
    };

    return (
        <PageContentBlock title={t('Security')}>
            <Toaster />
            <div className={'mb-6'}>
                <h1 className={'text-xl sm:text-2xl font-semibold text-gray-50'}>{t('Security')}</h1>
                <p className={'mt-1 text-sm text-gray-400'}>
                    {t('Protect your account, see where you are signed in and review recent sign-ins.')}
                </p>
            </div>

            {state?.twoFactorRedirect && (
                <div className={'mb-6'}>
                    <Callout tone={'red'} title={t('2-Factor Required')}>
                        {t('Your account must have two-factor authentication enabled in order to continue.')}
                    </Callout>
                </div>
            )}

            {error ? (
                <Callout tone={'red'}>{t('The security settings could not be loaded.')}</Callout>
            ) : !data ? (
                <div className={'space-y-6'}>
                    <Skeleton className={'h-44'} />
                    <div className={'grid lg:grid-cols-2 gap-6'}>
                        <Skeleton className={'h-64'} />
                        <Skeleton className={'h-64'} />
                    </div>
                </div>
            ) : (
                <div className={'space-y-6'}>
                    <SecurityScore data={data} />
                    <div className={'grid lg:grid-cols-2 gap-6 items-start'}>
                        <div className={'space-y-6'}>
                            <Section id={'two-factor'}>
                                <TwoFactorCard data={data} refresh={refresh} />
                            </Section>
                            {data.policy.passkeys && (
                                <Section id={'passkeys'}>
                                    <PasskeysCard data={data} refresh={refresh} />
                                </Section>
                            )}
                            <Section id={'pin'}>
                                <PinCard data={data} refresh={refresh} />
                            </Section>
                        </div>
                        <div className={'space-y-6'}>
                            <SessionsCard data={data} refresh={refresh} />
                            <TrustedDevicesCard data={data} refresh={refresh} />
                            <LoginHistoryCard data={data} />
                            <Section id={'alerts'}>
                                <AlertsCard data={data} refresh={refresh} />
                            </Section>
                        </div>
                    </div>
                </div>
            )}
        </PageContentBlock>
    );
};
