import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import {
    DotsHorizontalIcon,
    LogoutIcon,
    ServerIcon,
    ShieldCheckIcon,
    UserCircleIcon,
    XIcon,
} from '@heroicons/react/outline';
import Logo from '@/components/layout/Logo';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import Avatar from '@/components/Avatar';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { useStoreState } from '@/state/hooks';
import http from '@/api/http';
import styles from './style.module.css';
import { t } from '@/i18n';

export interface NavEntry {
    to: string;
    label: string;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    end?: boolean;
    /** Sidebar section the entry belongs to, a heading is rendered whenever the group changes. */
    group?: string;
    /** Props spread onto the link, used to preload the route when the user shows intent. */
    linkProps?: Partial<React.ComponentProps<typeof NavLink>>;
}

interface Props {
    nav: NavEntry[];
    /** Paths of the entries shown in the bottom bar on phones, defaults to the first entries. */
    primary?: string[];
    /** Rendered at the top of the sidebar, above the navigation (e.g. the current server). */
    context?: React.ReactNode;
    /** Rendered in the top bar, before the search. */
    title?: React.ReactNode;
    /** Extra content rendered directly below the top bar (e.g. connection warnings). */
    banner?: React.ReactNode;
    /** Hides the bottom navigation on phones, for full screen pages such as the file editor. */
    fullscreen?: boolean;
    children: React.ReactNode;
}

// Number of navigation items shown in the bottom bar on phones, the rest is in the "More" sheet.
const BOTTOM_BAR_ITEMS = 4;

// Group names double as identifiers, so they are translated when they are shown.
const groupLabels: Record<string, () => string> = {
    General: () => t('General'),
    Management: () => t('Management'),
    Infrastructure: () => t('Infrastructure'),
    Services: () => t('Services'),
    Panel: () => t('Panel'),
};
const groupLabel = (group: string) => groupLabels[group]?.() ?? t(group);

const NavItem = ({ entry, compact, onNavigate }: { entry: NavEntry; compact?: boolean; onNavigate?: () => void }) => {
    const Icon = entry.icon;

    return (
        <NavLink
            to={entry.to}
            end={entry.end}
            onClick={onNavigate}
            className={({ isActive }) =>
                classNames(compact ? styles.tab : styles.nav_item, { [styles.active]: isActive })
            }
            {...entry.linkProps}
        >
            {Icon && <Icon className={styles.nav_icon} aria-hidden />}
            <span className={compact ? styles.tab_label : 'truncate'}>{entry.label}</span>
        </NavLink>
    );
};

const useLogout = () => {
    const [loggingOut, setLoggingOut] = useState(false);

    const logout = () => {
        setLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            window.location.href = '/';
        });
    };

    return { loggingOut, logout };
};

const UserLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const { loggingOut, logout } = useLogout();
    const inAdmin = useLocation().pathname.startsWith('/admin');

    return (
        <>
            <SpinnerOverlay visible={loggingOut} fixed />
            <NavItem
                entry={{ to: '/', label: t('All servers'), icon: ServerIcon, end: true }}
                onNavigate={onNavigate}
            />
            <NavItem entry={{ to: '/account', label: t('Account'), icon: UserCircleIcon }} onNavigate={onNavigate} />
            {rootAdmin &&
                (inAdmin ? (
                    <Link to={'/'} onClick={onNavigate} className={styles.nav_item}>
                        <ServerIcon className={styles.nav_icon} aria-hidden />
                        <span>{t('Exit admin')}</span>
                    </Link>
                ) : (
                    <Link to={'/admin'} onClick={onNavigate} className={styles.nav_item}>
                        <ShieldCheckIcon className={styles.nav_icon} aria-hidden />
                        <span>{t('Admin area')}</span>
                    </Link>
                ))}
            <button type={'button'} onClick={logout} className={classNames(styles.nav_item, 'w-full')}>
                <LogoutIcon className={styles.nav_icon} aria-hidden />
                <span>{t('Sign out')}</span>
            </button>
        </>
    );
};

/** Admin switch and sign out next to the user badge, so the sidebar navigation keeps its room. */
const FooterActions = () => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const { loggingOut, logout } = useLogout();
    const inAdmin = useLocation().pathname.startsWith('/admin');

    return (
        <div className={'flex items-center gap-0.5 flex-shrink-0'}>
            <SpinnerOverlay visible={loggingOut} fixed />
            {rootAdmin && (
                <Link
                    to={inAdmin ? '/' : '/admin'}
                    className={styles.footer_action}
                    title={inAdmin ? t('Exit admin') : t('Admin area')}
                    aria-label={inAdmin ? t('Exit admin') : t('Admin area')}
                >
                    {inAdmin ? <ServerIcon className={'w-5 h-5'} /> : <ShieldCheckIcon className={'w-5 h-5'} />}
                </Link>
            )}
            <button
                type={'button'}
                onClick={logout}
                className={styles.footer_action}
                title={t('Sign out')}
                aria-label={t('Sign out')}
            >
                <LogoutIcon className={'w-5 h-5'} />
            </button>
        </div>
    );
};

const UserBadge = () => {
    const username = useStoreState((state) => state.user.data!.username);
    const email = useStoreState((state) => state.user.data!.email);

    return (
        <Link to={'/account'} className={styles.user_badge} title={`${username} · ${email}`}>
            <span className={'w-8 h-8 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-white/10'}>
                <Avatar.User />
            </span>
            <span className={'min-w-0'}>
                <span className={'block text-sm font-medium text-gray-100 truncate'}>{username}</span>
                <span className={'block text-xs text-gray-400 truncate'}>{email}</span>
            </span>
        </Link>
    );
};

export default ({ nav, primary, context, title, banner, fullscreen, children }: Props) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const { pathname } = useLocation();

    const navRef = useRef<HTMLElement>(null);

    // Close the "More" sheet whenever the page changes and keep the active entry of a sidebar that
    // scrolls on short screens visible.
    useEffect(() => {
        setMoreOpen(false);
        navRef.current?.querySelector(`.${styles.active}`)?.scrollIntoView({ block: 'nearest' });
    }, [pathname]);

    const preferred = primary ? nav.filter((entry) => primary.includes(entry.to)) : nav;
    const bottomItems = preferred.slice(0, BOTTOM_BAR_ITEMS);
    const sheetItems = nav.filter((entry) => !bottomItems.includes(entry));
    const hasMore = true;

    return (
        <div className={styles.shell}>
            <aside className={styles.sidebar}>
                <Link to={'/'} className={'flex items-center h-16 px-5 no-underline'}>
                    <Logo />
                </Link>
                {context && <div className={'px-3 pb-3'}>{context}</div>}
                <nav ref={navRef} className={styles.nav} aria-label={t('Main navigation')}>
                    {nav.map((entry, index) => (
                        <React.Fragment key={entry.to}>
                            {entry.group && entry.group !== nav[index - 1]?.group && (
                                <p className={styles.nav_group}>{groupLabel(entry.group)}</p>
                            )}
                            <NavItem entry={entry} />
                        </React.Fragment>
                    ))}
                </nav>
                <div className={styles.sidebar_footer}>
                    <UserBadge />
                    <FooterActions />
                </div>
            </aside>
            <div className={styles.main}>
                <header className={styles.topbar}>
                    <Link to={'/'} className={'lg:hidden no-underline'} aria-label={t('All servers')}>
                        <Logo iconOnly size={'sm'} />
                    </Link>
                    <div className={'flex-1 min-w-0 text-sm font-semibold text-gray-100 truncate'}>{title}</div>
                    <SearchContainer className={'hidden sm:flex'} />
                    <SearchContainer compact className={'sm:hidden'} />
                    <Link
                        to={'/account'}
                        className={'lg:hidden w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10'}
                    >
                        <Avatar.User />
                    </Link>
                </header>
                {banner}
                <main className={classNames(styles.content, { [styles.content_fullscreen]: fullscreen })}>
                    {children}
                </main>
            </div>
            <nav className={classNames(styles.bottom_bar, { hidden: fullscreen })} aria-label={t('Navigation')}>
                {bottomItems.map((entry) => (
                    <NavItem key={entry.to} entry={entry} compact />
                ))}
                {hasMore && (
                    <button
                        type={'button'}
                        className={classNames(styles.tab, { [styles.active]: moreOpen })}
                        onClick={() => setMoreOpen(true)}
                        aria-expanded={moreOpen}
                    >
                        <DotsHorizontalIcon className={styles.nav_icon} aria-hidden />
                        <span className={styles.tab_label}>{t('More')}</span>
                    </button>
                )}
            </nav>
            {moreOpen && (
                <div className={styles.sheet_backdrop} onClick={() => setMoreOpen(false)}>
                    <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role={'dialog'} aria-modal>
                        <div className={'flex items-center justify-between mb-2'}>
                            <UserBadge />
                            <button
                                type={'button'}
                                aria-label={t('Close')}
                                className={'p-2 rounded-md text-gray-400 hover:text-white'}
                                onClick={() => setMoreOpen(false)}
                            >
                                <XIcon className={'w-5 h-5'} />
                            </button>
                        </div>
                        {context && <div className={'mb-2'}>{context}</div>}
                        <div className={'grid grid-cols-2 gap-1'}>
                            {sheetItems.map((entry) => (
                                <NavItem key={entry.to} entry={entry} onNavigate={() => setMoreOpen(false)} />
                            ))}
                        </div>
                        <div className={'mt-2 pt-2 border-t border-gray-800 grid grid-cols-2 gap-1'}>
                            <UserLinks onNavigate={() => setMoreOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
