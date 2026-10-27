import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { animate, useInView } from 'framer-motion';
import { t } from '@/i18n';

type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'blue';

const tones: Record<Tone, string> = {
    green: 'bg-raptor-500/10 text-raptor-300 ring-raptor-500/25',
    yellow: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
    red: 'bg-rose-500/10 text-rose-300 ring-rose-500/25',
    gray: 'bg-gray-800 text-gray-300 ring-gray-700',
    blue: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
};

export const Badge = ({
    tone = 'gray',
    dot,
    className,
    children,
}: {
    tone?: Tone;
    dot?: boolean;
    className?: string;
    children: React.ReactNode;
}) => (
    <span
        className={classNames(
            'inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[0.7rem] font-medium ring-1 ring-inset whitespace-nowrap',
            tones[tone],
            className
        )}
    >
        {dot && <span className={'w-1.5 h-1.5 rounded-full bg-current'} />}
        {children}
    </span>
);

/** Shows the installation / suspension state of a server. */
export const ServerStatusBadge = ({ status }: { status: string | null }) => {
    switch (status) {
        case null:
            return (
                <Badge tone={'green'} dot>
                    {t('Installed')}
                </Badge>
            );
        case 'installing':
            return (
                <Badge tone={'blue'} dot>
                    {t('Installing')}
                </Badge>
            );
        case 'install_failed':
        case 'reinstall_failed':
            return (
                <Badge tone={'red'} dot>
                    {t('Install failed')}
                </Badge>
            );
        case 'suspended':
            return (
                <Badge tone={'yellow'} dot>
                    {t('Suspended')}
                </Badge>
            );
        case 'restoring_backup':
            return (
                <Badge tone={'blue'} dot>
                    {t('Restoring backup')}
                </Badge>
            );
        default:
            return <Badge>{status}</Badge>;
    }
};

/** Animated usage bar. A value above 100% (overallocation) is shown in red. */
export const Meter = ({ value, max, className }: { value: number; max: number; className?: string }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;

    return (
        <div className={classNames('h-1.5 rounded-full bg-gray-800 overflow-hidden', className)}>
            <div
                className={classNames('h-full rounded-full origin-left animate-grow transition-[width] duration-500', {
                    'bg-raptor-500': percent <= 75,
                    'bg-amber-400': percent > 75 && percent <= 90,
                    'bg-rose-500': percent > 90,
                })}
                style={{ width: `${Math.min(100, percent)}%` }}
            />
        </div>
    );
};

/** Counts up to the given number the first time it scrolls into view. */
export const CountUp = ({
    value,
    format = (n) => Math.round(n).toLocaleString(),
}: {
    value: number;
    format?: (n: number) => string;
}) => {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (!inView) return;

        const controls = animate(display, value, {
            duration: 0.9,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (latest) => setDisplay(latest),
        });

        return () => controls.stop();
    }, [inView, value]);

    return (
        <span ref={ref} className={'tabular-nums'}>
            {format(display)}
        </span>
    );
};

export const StatCard = ({
    label,
    value,
    icon: Icon,
    hint,
    tone = 'green',
    href,
}: {
    label: string;
    value: number;
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    hint?: React.ReactNode;
    tone?: Tone;
    href?: string;
}) => {
    const content = (
        <>
            <div className={'flex items-center justify-between'}>
                <p className={'text-xs font-medium text-gray-400'}>{label}</p>
                <span
                    className={classNames('grid place-items-center w-8 h-8 rounded-lg ring-1 ring-inset', tones[tone])}
                >
                    <Icon className={'w-4 h-4'} />
                </span>
            </div>
            <p className={'mt-2 text-2xl font-semibold text-gray-50'}>
                <CountUp value={value} />
            </p>
            {hint && <p className={'mt-1 text-xs text-gray-500 leading-snug'}>{hint}</p>}
        </>
    );

    const className =
        'group block rounded-xl bg-gray-900/70 ring-1 ring-inset ring-gray-800 p-4 shadow-card no-underline transition duration-150 hover:ring-raptor-500/40 hover:-translate-y-0.5';

    return (
        <div>
            {href ? (
                <Link to={href} className={className}>
                    {content}
                </Link>
            ) : (
                <div className={className}>{content}</div>
            )}
        </div>
    );
};

export const Skeleton = ({ className }: { className?: string }) => (
    <div className={classNames('rounded-md bg-gray-800/70 animate-pulse', className)} />
);

export const EmptyState = ({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
}) => (
    <div className={'flex flex-col items-center text-center py-12 px-6 animate-fade-in'}>
        <span
            className={
                'relative grid place-items-center w-14 h-14 rounded-2xl bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/20'
            }
        >
            <Icon className={'w-6 h-6 text-raptor-400'} />
            <span className={'absolute inset-0 rounded-2xl animate-pulse-ring'} />
        </span>
        <p className={'mt-4 text-sm font-semibold text-gray-100'}>{title}</p>
        {description && <p className={'mt-1 max-w-sm text-sm text-gray-400'}>{description}</p>}
        {action && <div className={'mt-5'}>{action}</div>}
    </div>
);

export const Callout = ({
    tone = 'blue',
    title,
    children,
    icon: Icon,
}: {
    tone?: 'blue' | 'yellow' | 'red' | 'green';
    title?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    children: React.ReactNode;
}) => (
    <div
        className={classNames('flex gap-3 rounded-lg p-3 text-sm ring-1 ring-inset', {
            'bg-sky-500/5 ring-sky-500/20 text-sky-100': tone === 'blue',
            'bg-amber-500/5 ring-amber-500/20 text-amber-100': tone === 'yellow',
            'bg-rose-500/5 ring-rose-500/20 text-rose-100': tone === 'red',
            'bg-raptor-500/5 ring-raptor-500/20 text-raptor-100': tone === 'green',
        })}
    >
        {Icon && <Icon className={'w-5 h-5 flex-shrink-0 opacity-80'} />}
        <div className={'min-w-0 leading-relaxed'}>
            {title && <p className={'font-semibold mb-0.5'}>{title}</p>}
            <div className={'opacity-90'}>{children}</div>
        </div>
    </div>
);
