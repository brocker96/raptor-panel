import React, { useState } from 'react';
import classNames from 'classnames';
import { CheckIcon, ClipboardCopyIcon, EyeIcon, EyeOffIcon } from '@heroicons/react/outline';
import { t } from '@/i18n';

interface Props {
    label: React.ReactNode;
    value: string;
    /** Hides the value behind dots until revealed, for passwords and connection strings. */
    secret?: boolean;
    mono?: boolean;
    className?: string;
}

export const useCopy = () => {
    const [copied, setCopied] = useState(false);

    const copy = (text: string) =>
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });

    return { copied, copy };
};

/** A read only value with a copy button, and optionally a reveal button for secrets. */
const CopyField = ({ label, value, secret, mono = true, className }: Props) => {
    const [revealed, setRevealed] = useState(false);
    const { copied, copy } = useCopy();
    const hidden = secret && !revealed;

    return (
        <div className={classNames('min-w-0', className)}>
            <p className={'mb-1 text-xs text-gray-500'}>{label}</p>
            <div
                className={
                    'flex items-center gap-1 rounded-lg bg-gray-950/60 ring-1 ring-inset ring-gray-800 pl-3 pr-1 py-1'
                }
            >
                <span
                    className={classNames(
                        'flex-1 min-w-0 truncate text-sm text-gray-100 py-0.5',
                        mono && 'font-mono text-[0.8rem]'
                    )}
                    title={hidden ? undefined : value}
                >
                    {hidden ? '•'.repeat(Math.min(value.length, 16)) : value}
                </span>
                {secret && (
                    <button
                        type={'button'}
                        onClick={() => setRevealed((v) => !v)}
                        aria-label={revealed ? t('Hide') : t('Show')}
                        title={revealed ? t('Hide') : t('Show')}
                        className={
                            'grid place-items-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-100 hover:bg-white/5'
                        }
                    >
                        {revealed ? <EyeOffIcon className={'w-4 h-4'} /> : <EyeIcon className={'w-4 h-4'} />}
                    </button>
                )}
                <button
                    type={'button'}
                    onClick={() => copy(value)}
                    aria-label={t('Copy')}
                    title={t('Copy')}
                    className={classNames(
                        'grid place-items-center w-7 h-7 rounded-md hover:bg-white/5',
                        copied ? 'text-raptor-400' : 'text-gray-500 hover:text-gray-100'
                    )}
                >
                    {copied ? <CheckIcon className={'w-4 h-4'} /> : <ClipboardCopyIcon className={'w-4 h-4'} />}
                </button>
            </div>
        </div>
    );
};

export default CopyField;
