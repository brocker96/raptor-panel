import React from 'react';
import { Link } from 'react-router-dom';
import { ChatAlt2Icon, CreditCardIcon, LockClosedIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import { buttonClass } from '@/components/admin/ui/Button';
import { t } from '@/i18n';

/**
 * Shown instead of the server while it is suspended: why, and the way back (paying the
 * invoice or asking support) instead of a dead end.
 */
export default () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const suspension = ServerContext.useStoreState((state) => state.server.data!.suspension);
    const billingUrl = ServerContext.useStoreState((state) => state.server.data!.billingUrl);
    const support = useStoreState((state) => !!state.settings.data?.support);
    const payUrl = suspension?.url || billingUrl;

    return (
        <div className={'min-h-[60vh] grid place-items-center px-4 py-12'}>
            <div className={'w-full max-w-lg text-center animate-fade-in'}>
                <span
                    className={
                        'relative mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-amber-500/10 ring-1 ring-inset ring-amber-500/25'
                    }
                >
                    <LockClosedIcon className={'w-7 h-7 text-amber-300'} />
                </span>
                <h1 className={'mt-5 text-2xl font-semibold text-gray-50'}>{t('Server suspended')}</h1>
                <p className={'mt-2 text-sm text-gray-400'}>
                    {t('{{name}} is paused, its files are safe and nothing has been deleted.', { name })}
                </p>
                {suspension?.reason && (
                    <div
                        className={
                            'mt-5 rounded-xl bg-gray-900/70 ring-1 ring-inset ring-gray-800 px-4 py-3 text-left text-sm text-gray-200'
                        }
                    >
                        <p className={'text-[0.65rem] uppercase tracking-wider text-gray-500 mb-1'}>{t('Reason')}</p>
                        <p className={'whitespace-pre-wrap break-words'}>{suspension.reason}</p>
                    </div>
                )}
                <div className={'mt-6 flex flex-wrap justify-center gap-3'}>
                    {payUrl && (
                        <a
                            href={payUrl}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                            className={buttonClass('primary')}
                        >
                            <CreditCardIcon className={'w-4 h-4'} />
                            {suspension?.url ? t('Pay and reactivate') : t('Open billing')}
                        </a>
                    )}
                    {support && (
                        <Link to={'/account/support'} className={buttonClass('secondary')}>
                            <ChatAlt2Icon className={'w-4 h-4'} />
                            {t('Contact support')}
                        </Link>
                    )}
                </div>
                {payUrl && (
                    <p className={'mt-4 text-xs text-gray-500'}>
                        {t('The server starts working again a few moments after the payment arrives.')}
                    </p>
                )}
            </div>
        </div>
    );
};
