import React, { useEffect } from 'react';
import classNames from 'classnames';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpenIcon, ChevronRightIcon } from '@heroicons/react/outline';
import { useGuide } from '@/components/admin/guides/GuideContext';
import { useStoreState } from '@/state/hooks';
import { t } from '@/i18n';

interface PageProps {
    title: string;
    description?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    /** Breadcrumb trail rendered above the title. */
    crumbs?: { label: string; to?: string }[];
    /** Key of the guide opened by the "Guide" button. */
    guide?: string;
    actions?: React.ReactNode;
    /** Rendered below the header, typically tabs. */
    tabs?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Wraps every admin page: sets the document title, renders the animated header with the guide
 * button and staggers the entrance of the page content.
 */
export const Page = ({ title, description, icon: Icon, crumbs, guide, actions, tabs, children }: PageProps) => {
    const name = useStoreState((state) => state.settings.data?.name);
    const { open } = useGuide();

    useEffect(() => {
        document.title = `${title} | Admin | ${name || 'Raptor Panel'}`;
    }, [title, name]);

    return (
        <div className={'pb-6 animate-page'}>
            <header className={'mb-6'}>
                {crumbs && crumbs.length > 0 && (
                    <nav
                        className={'flex items-center gap-1 mb-3 text-xs text-gray-500 min-w-0'}
                        aria-label={t('Breadcrumb')}
                    >
                        {crumbs.map((crumb, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <ChevronRightIcon className={'w-3 h-3 flex-shrink-0'} />}
                                {crumb.to ? (
                                    <Link to={crumb.to} className={'hover:text-gray-200 no-underline truncate'}>
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className={'truncate text-gray-400'}>{crumb.label}</span>
                                )}
                            </React.Fragment>
                        ))}
                    </nav>
                )}
                <div className={'flex flex-col sm:flex-row sm:items-start gap-4'}>
                    {Icon && (
                        <span
                            className={
                                'animate-pop hidden sm:grid place-items-center flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-raptor-500/25 to-raptor-500/5 ring-1 ring-inset ring-raptor-500/30 text-raptor-300 shadow-glow'
                            }
                        >
                            <Icon className={'w-6 h-6'} />
                        </span>
                    )}
                    <div className={'flex-1 min-w-0'}>
                        <h1
                            className={
                                'text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-gray-50 break-words'
                            }
                        >
                            {title}
                        </h1>
                        {description && (
                            <p className={'mt-1 text-sm text-gray-400 max-w-3xl leading-relaxed'}>{description}</p>
                        )}
                    </div>
                    <div className={'flex flex-wrap items-center gap-2 sm:justify-end sm:max-w-[55%]'}>
                        {guide && (
                            <button
                                type={'button'}
                                onClick={() => open(guide)}
                                className={
                                    'group inline-flex items-center gap-2 h-10 px-3.5 rounded-lg text-sm font-medium text-raptor-200 bg-raptor-500/10 ring-1 ring-inset ring-raptor-500/25 hover:bg-raptor-500/20 transition-colors'
                                }
                            >
                                <BookOpenIcon
                                    className={
                                        'w-4 h-4 transition-transform group-hover:-rotate-6 group-hover:scale-110'
                                    }
                                />
                                {t('Guide')}
                            </button>
                        )}
                        {actions}
                    </div>
                </div>
                {tabs && <div className={'mt-5'}>{tabs}</div>}
            </header>
            <div className={'space-y-6'}>{children}</div>
        </div>
    );
};

interface TabItem {
    to: string;
    label: string;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    end?: boolean;
}

/** Route based tabs with an animated active indicator, horizontally scrollable on phones. */
export const Tabs = ({ items, id }: { items: TabItem[]; id: string }) => {
    const { pathname } = useLocation();

    return (
        <div className={'-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none border-b border-gray-800'}>
            <nav className={'flex gap-1 min-w-max'}>
                {items.map((tab) => {
                    const active = tab.end
                        ? pathname === tab.to
                        : pathname === tab.to || pathname.startsWith(tab.to + '/');
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.end}
                            className={classNames(
                                'relative flex items-center gap-2 h-10 px-3 text-sm font-medium no-underline transition-colors',
                                active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                            )}
                        >
                            {Icon && <Icon className={classNames('w-4 h-4', active && 'text-raptor-400')} />}
                            {tab.label}
                            {active && (
                                <motion.span
                                    layoutId={`tab-${id}`}
                                    className={
                                        'absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-raptor-400 shadow-[0_0_12px_rgb(82_211_33/0.8)]'
                                    }
                                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                />
                            )}
                        </NavLink>
                    );
                })}
            </nav>
        </div>
    );
};

/** Segmented control for switching between a few views without changing the URL. */
export const Segmented = <T extends string>({
    value,
    onChange,
    options,
    id,
}: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string }[];
    id: string;
}) => (
    <div className={'inline-flex p-1 rounded-lg bg-gray-950/60 ring-1 ring-inset ring-gray-800'}>
        {options.map((option) => (
            <button
                key={option.value}
                type={'button'}
                onClick={() => onChange(option.value)}
                className={classNames(
                    'relative h-8 px-3 rounded-md text-xs font-medium transition-colors',
                    value === option.value ? 'text-gray-950' : 'text-gray-400 hover:text-gray-200'
                )}
            >
                {value === option.value && (
                    <motion.span
                        layoutId={`segmented-${id}`}
                        className={'absolute inset-0 rounded-md bg-raptor-400'}
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                )}
                <span className={'relative'}>{option.label}</span>
            </button>
        ))}
    </div>
);
