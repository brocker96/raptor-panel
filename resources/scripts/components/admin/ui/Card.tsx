import React from 'react';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { item } from '@/components/admin/ui/motion';

interface CardProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Rendered on the right side of the card header. */
    actions?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    /** Removes the padding around the body, for tables and lists that run edge to edge. */
    flush?: boolean;
    /** Renders a red accent, used for destructive sections such as "Delete server". */
    danger?: boolean;
    footer?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}

export const Card = ({
    title,
    description,
    actions,
    icon: Icon,
    flush,
    danger,
    footer,
    className,
    children,
}: CardProps) => (
    <motion.section
        variants={item}
        className={classNames(
            'relative rounded-xl bg-gray-900/70 ring-1 ring-inset shadow-card overflow-hidden',
            danger ? 'ring-red-500/25' : 'ring-gray-800',
            className
        )}
    >
        {(title || actions) && (
            <header className={'flex items-start gap-3 px-4 sm:px-5 pt-4 sm:pt-5'}>
                {Icon && (
                    <span
                        className={classNames(
                            'mt-0.5 flex-shrink-0 grid place-items-center w-8 h-8 rounded-lg ring-1 ring-inset',
                            danger
                                ? 'bg-red-500/10 text-red-400 ring-red-500/20'
                                : 'bg-raptor-500/10 text-raptor-400 ring-raptor-500/20'
                        )}
                    >
                        <Icon className={'w-4 h-4'} />
                    </span>
                )}
                <div className={'flex-1 min-w-0'}>
                    {title && <h2 className={'text-sm font-semibold text-gray-50'}>{title}</h2>}
                    {description && <p className={'mt-0.5 text-xs text-gray-400 leading-relaxed'}>{description}</p>}
                </div>
                {actions && <div className={'flex flex-shrink-0 items-center gap-2'}>{actions}</div>}
            </header>
        )}
        <div className={classNames({ 'p-4 sm:p-5': !flush, 'mt-4': flush && (title || actions) })}>{children}</div>
        {footer && (
            <footer
                className={
                    'flex flex-wrap items-center justify-end gap-2 px-4 sm:px-5 py-3 bg-gray-950/40 border-t border-gray-800'
                }
            >
                {footer}
            </footer>
        )}
    </motion.section>
);

/** Two column definition list used on detail pages ("Node: node-1", "Memory: 4 GiB"). */
export const Details = ({ items }: { items: [React.ReactNode, React.ReactNode][] }) => (
    <dl className={'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3'}>
        {items.map(([label, value], index) => (
            <div key={index} className={'min-w-0'}>
                <dt className={'text-2xs uppercase tracking-wider text-gray-500'}>{label}</dt>
                <dd className={'mt-0.5 text-sm text-gray-200 break-words'}>{value ?? '—'}</dd>
            </div>
        ))}
    </dl>
);
