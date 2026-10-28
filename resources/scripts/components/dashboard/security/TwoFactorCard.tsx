import React, { useState } from 'react';
import { DeviceMobileIcon, RefreshIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout } from '@/components/admin/ui/Feedback';
import { useAction } from '@/components/admin/ui/hooks';
import SetupTOTPDialog from '@/components/dashboard/forms/SetupTOTPDialog';
import DisableTOTPDialog from '@/components/dashboard/forms/DisableTOTPDialog';
import RecoveryTokensDialog from '@/components/dashboard/forms/RecoveryTokensDialog';
import FlashMessageRender from '@/components/FlashMessageRender';
import { regenerateRecoveryCodes, SecurityOverview } from '@/api/account/security';
import { t } from '@/i18n';

interface Props {
    data: SecurityOverview;
    refresh: () => void;
}

const TwoFactorCard = ({ data, refresh }: Props) => {
    const [dialog, setDialog] = useState<'enable' | 'disable' | null>(null);
    const [tokens, setTokens] = useState<{ title: string; list: string[] } | null>(null);
    const regenerate = useAction(regenerateRecoveryCodes, {
        onSuccess: (list) => {
            setTokens({ title: t('New recovery codes'), list });
            refresh();
        },
    });

    const { enabled, recoveryCodes } = data.twoFactor;

    return (
        <Card
            icon={DeviceMobileIcon}
            title={t('Two-step verification')}
            description={t(
                'Sign in with your password and a code from an authenticator app such as Aegis, 2FAS or Google Authenticator.'
            )}
            actions={
                <Badge tone={enabled ? 'green' : 'gray'} dot>
                    {enabled ? t('On') : t('Off')}
                </Badge>
            }
        >
            <FlashMessageRender byKey={'account:two-step'} className={'mb-4'} />
            <SetupTOTPDialog
                open={dialog === 'enable'}
                onClose={() => setDialog(null)}
                onTokens={(list) => {
                    setDialog(null);
                    setTokens({ title: t('Two-Step Authentication Enabled'), list });
                    refresh();
                }}
            />
            <DisableTOTPDialog
                open={dialog === 'disable'}
                onClose={() => {
                    setDialog(null);
                    refresh();
                }}
            />
            <RecoveryTokensDialog
                title={tokens?.title}
                tokens={tokens?.list || []}
                open={!!tokens}
                onClose={() => setTokens(null)}
            />

            {enabled ? (
                <div className={'space-y-4'}>
                    <div
                        className={
                            'flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 px-3 py-2.5'
                        }
                    >
                        <div className={'min-w-0'}>
                            <p className={'text-sm text-gray-200'}>{t('Recovery codes')}</p>
                            <p className={'text-xs text-gray-500'}>
                                {t('{{count}} of 10 unused codes left', { count: recoveryCodes })}
                            </p>
                        </div>
                        <Button
                            size={'sm'}
                            variant={'secondary'}
                            icon={RefreshIcon}
                            loading={regenerate.loading}
                            onClick={() => regenerate.run()}
                        >
                            {t('Generate new codes')}
                        </Button>
                    </div>
                    {recoveryCodes < 3 && (
                        <Callout tone={'yellow'}>
                            {t('Only a few recovery codes are left. Generate new ones and store them somewhere safe.')}
                        </Callout>
                    )}
                    <div className={'flex justify-end'}>
                        <Button variant={'danger'} size={'sm'} onClick={() => setDialog('disable')}>
                            {t('Disable two-step verification')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className={'space-y-4'}>
                    {data.policy.twoFactorRequired > 0 && (
                        <Callout tone={'yellow'}>
                            {t(
                                'The administrator requires two-step verification for your account. Enable it to keep using the panel.'
                            )}
                        </Callout>
                    )}
                    <Button onClick={() => setDialog('enable')}>{t('Enable two-step verification')}</Button>
                </div>
            )}
        </Card>
    );
};

export default TwoFactorCard;
