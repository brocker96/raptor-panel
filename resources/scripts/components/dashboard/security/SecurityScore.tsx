import React from 'react';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/solid';
import { ShieldCheckIcon } from '@heroicons/react/outline';
import { SecurityOverview } from '@/api/account/security';
import { t } from '@/i18n';

interface Check {
    id: string;
    label: string;
    hint: string;
    weight: number;
    done: boolean;
    target: string;
}

export const securityChecks = (data: SecurityOverview): Check[] => [
    {
        id: 'two-factor',
        label: t('Two-step verification'),
        hint: t('A code from your phone is needed to sign in, even if your password leaks.'),
        weight: 30,
        done: data.twoFactor.enabled,
        target: 'two-factor',
    },
    {
        id: 'passkey',
        label: t('A passkey'),
        hint: t('Sign in with your fingerprint, face or a security key. Passkeys cannot be phished.'),
        weight: 25,
        done: data.passkeys.length > 0,
        target: 'passkeys',
    },
    {
        id: 'pin',
        label: t('A security PIN'),
        hint: t('Confirm sensitive actions and unlock the panel quickly.'),
        weight: 15,
        done: data.pin.enabled,
        target: 'pin',
    },
    {
        id: 'lock',
        label: t('Automatic screen lock'),
        hint: t('The panel locks itself when you walk away from your computer.'),
        weight: 10,
        done: !!data.screenLock.effective,
        target: 'pin',
    },
    {
        id: 'recovery',
        label: t('Recovery codes'),
        hint: t('Keep at least three unused codes in case you lose your phone.'),
        weight: 10,
        done: data.twoFactor.enabled && data.twoFactor.recoveryCodes >= 3,
        target: 'two-factor',
    },
    {
        id: 'alerts',
        label: t('Sign-in alerts'),
        hint: t('Get an e-mail when your account is used on a new device.'),
        weight: 10,
        done: data.alerts,
        target: 'alerts',
    },
];

const level = (score: number) => {
    if (score >= 90) return { label: t('Excellent'), color: 'text-raptor-400', stroke: 'stroke-raptor-400' };
    if (score >= 70) return { label: t('Strong'), color: 'text-raptor-300', stroke: 'stroke-raptor-300' };
    if (score >= 40) return { label: t('Fair'), color: 'text-amber-300', stroke: 'stroke-amber-300' };

    return { label: t('Weak'), color: 'text-rose-300', stroke: 'stroke-rose-400' };
};

const scrollTo = (id: string) =>
    document.getElementById(`security-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const SecurityScore = ({ data }: { data: SecurityOverview }) => {
    const checks = securityChecks(data);
    const score = checks.reduce((total, check) => total + (check.done ? check.weight : 0), 0);
    const { label, color, stroke } = level(score);
    const circumference = 2 * Math.PI * 42;
    const missing = checks.filter((check) => !check.done);

    return (
        <section
            className={
                'relative overflow-hidden rounded-2xl bg-gray-900/70 ring-1 ring-inset ring-gray-800 shadow-card p-5 sm:p-6'
            }
        >
            <div
                aria-hidden
                className={
                    'absolute -top-24 -left-24 w-72 h-72 rounded-full bg-raptor-500/10 blur-3xl pointer-events-none'
                }
            />
            <div className={'relative flex flex-col md:flex-row gap-6 md:items-center'}>
                <div className={'flex items-center gap-5'}>
                    <div className={'relative w-28 h-28 flex-shrink-0'}>
                        <svg viewBox={'0 0 100 100'} className={'w-28 h-28 -rotate-90'}>
                            <circle
                                cx={50}
                                cy={50}
                                r={42}
                                className={'stroke-gray-800'}
                                strokeWidth={8}
                                fill={'none'}
                            />
                            <motion.circle
                                cx={50}
                                cy={50}
                                r={42}
                                className={stroke}
                                strokeWidth={8}
                                strokeLinecap={'round'}
                                fill={'none'}
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                            />
                        </svg>
                        <div className={'absolute inset-0 grid place-items-center text-center'}>
                            <div>
                                <p className={classNames('text-2xl font-bold tabular-nums', color)}>{score}</p>
                                <p className={'text-2xs uppercase tracking-wider text-gray-500'}>/ 100</p>
                            </div>
                        </div>
                    </div>
                    <div className={'min-w-0'}>
                        <p className={'text-2xs uppercase tracking-wider text-gray-500'}>{t('Security score')}</p>
                        <p className={classNames('mt-0.5 text-xl font-semibold', color)}>{label}</p>
                        <p className={'mt-1 text-sm text-gray-400 max-w-xs'}>
                            {missing.length === 0
                                ? t('Your account uses every protection the panel offers.')
                                : t('{{count}} steps left to fully protect your account.', { count: missing.length })}
                        </p>
                    </div>
                </div>
                <ul className={'flex-1 grid sm:grid-cols-2 gap-2'}>
                    {checks.map((check) => (
                        <li key={check.id}>
                            <button
                                type={'button'}
                                onClick={() => scrollTo(check.target)}
                                title={check.hint}
                                className={classNames(
                                    'w-full flex items-start gap-2.5 rounded-lg px-3 py-2 text-left ring-1 ring-inset transition-colors',
                                    check.done
                                        ? 'ring-raptor-500/15 bg-raptor-500/5 hover:bg-raptor-500/10'
                                        : 'ring-gray-800 bg-gray-950/30 hover:ring-gray-700'
                                )}
                            >
                                {check.done ? (
                                    <CheckCircleIcon className={'mt-0.5 w-4 h-4 flex-shrink-0 text-raptor-400'} />
                                ) : (
                                    <ShieldCheckIcon className={'mt-0.5 w-4 h-4 flex-shrink-0 text-gray-500'} />
                                )}
                                <span className={'min-w-0'}>
                                    <span
                                        className={classNames(
                                            'block text-sm break-words',
                                            check.done ? 'text-gray-200' : 'text-gray-300'
                                        )}
                                    >
                                        {check.label}
                                    </span>
                                    {!check.done && (
                                        <span className={'block text-xs text-gray-500 leading-snug'}>{check.hint}</span>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

export default SecurityScore;
