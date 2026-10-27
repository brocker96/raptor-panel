import React, { lazy, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
    ArrowCircleUpIcon,
    BookOpenIcon,
    ChipIcon,
    ClipboardListIcon,
    CloudIcon,
    CogIcon,
    CollectionIcon,
    DatabaseIcon,
    FolderIcon,
    GlobeIcon,
    KeyIcon,
    ServerIcon,
    TemplateIcon,
    UsersIcon,
    ViewGridIcon,
} from '@heroicons/react/outline';
import Shell, { NavEntry } from '@/components/layout/Shell';
import Spinner from '@/components/elements/Spinner';
import { NotFound } from '@/components/elements/ScreenBlock';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { useStoreState } from '@/state/hooks';
import { GuideProvider } from '@/components/admin/guides/GuideContext';
import GuideDrawer from '@/components/admin/guides/GuideDrawer';
import { Toaster } from '@/components/admin/ui/Toast';
import { t } from '@/i18n';

const Overview = lazy(() => import('@/components/admin/overview/OverviewContainer'));
const Servers = lazy(() => import('@/components/admin/servers/ServersContainer'));
const ServerCreate = lazy(() => import('@/components/admin/servers/ServerCreateContainer'));
const ServerView = lazy(() => import('@/components/admin/servers/ServerViewContainer'));
const Users = lazy(() => import('@/components/admin/users/UsersContainer'));
const UserView = lazy(() => import('@/components/admin/users/UserViewContainer'));
const Nodes = lazy(() => import('@/components/admin/nodes/NodesContainer'));
const NodeCreate = lazy(() => import('@/components/admin/nodes/NodeCreateContainer'));
const NodeView = lazy(() => import('@/components/admin/nodes/NodeViewContainer'));
const Locations = lazy(() => import('@/components/admin/locations/LocationsContainer'));
const Nests = lazy(() => import('@/components/admin/nests/NestsContainer'));
const EggView = lazy(() => import('@/components/admin/nests/EggViewContainer'));
const EggCreate = lazy(() => import('@/components/admin/nests/EggCreateContainer'));
const DatabaseHosts = lazy(() => import('@/components/admin/databases/DatabaseHostsContainer'));
const Mounts = lazy(() => import('@/components/admin/mounts/MountsContainer'));
const MountView = lazy(() => import('@/components/admin/mounts/MountViewContainer'));
const Settings = lazy(() => import('@/components/admin/settings/SettingsContainer'));
const ApiKeys = lazy(() => import('@/components/admin/api/ApiKeysContainer'));
const AuditLog = lazy(() => import('@/components/admin/activity/AuditLogContainer'));
const System = lazy(() => import('@/components/admin/system/SystemContainer'));
const Updates = lazy(() => import('@/components/admin/updates/UpdatesContainer'));
const GuideHub = lazy(() => import('@/components/admin/guides/GuidesContainer').then((m) => ({ default: m.GuideHub })));
const GuideView = lazy(() =>
    import('@/components/admin/guides/GuidesContainer').then((m) => ({ default: m.GuideView }))
);

const nav: NavEntry[] = [
    { to: '/admin', label: t('Overview'), icon: ViewGridIcon, end: true, group: 'General' },
    { to: '/admin/guides', label: t('Guides'), icon: BookOpenIcon, group: 'General' },
    { to: '/admin/servers', label: t('Servers'), icon: ServerIcon, group: 'Management' },
    { to: '/admin/users', label: t('Users'), icon: UsersIcon, group: 'Management' },
    { to: '/admin/nodes', label: t('Nodes'), icon: ChipIcon, group: 'Infrastructure' },
    { to: '/admin/locations', label: t('Locations'), icon: GlobeIcon, group: 'Infrastructure' },
    { to: '/admin/databases', label: t('Databases'), icon: DatabaseIcon, group: 'Infrastructure' },
    { to: '/admin/mounts', label: t('Mounts'), icon: FolderIcon, group: 'Infrastructure' },
    { to: '/admin/nests', label: t('Nests & eggs'), icon: CollectionIcon, group: 'Services' },
    { to: '/admin/settings', label: t('Settings'), icon: CogIcon, group: 'Panel' },
    { to: '/admin/api', label: t('API keys'), icon: KeyIcon, group: 'Panel' },
    { to: '/admin/activity', label: t('Audit log'), icon: ClipboardListIcon, group: 'Panel' },
    { to: '/admin/system', label: t('System'), icon: TemplateIcon, group: 'Panel' },
    { to: '/admin/updates', label: t('Updates'), icon: ArrowCircleUpIcon, group: 'Panel' },
];

const AdminContextCard = () => (
    <div
        className={
            'relative overflow-hidden rounded-lg p-3 bg-gradient-to-br from-raptor-500/15 via-gray-900 to-gray-900 ring-1 ring-inset ring-raptor-500/25'
        }
    >
        <div className={'absolute -right-6 -top-6 w-20 h-20 rounded-full bg-raptor-500/20 blur-2xl'} />
        <p
            className={
                'relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-raptor-300'
            }
        >
            <CloudIcon className={'w-4 h-4'} /> {t('Admin area')}
        </p>
        <p className={'relative mt-1 text-xs text-gray-400'}>{t('Changes here affect the whole Panel.')}</p>
    </div>
);

export default () => {
    const location = useLocation();
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);

    const current = useMemo(
        () =>
            nav
                .filter((entry) =>
                    entry.end ? location.pathname === entry.to : location.pathname.startsWith(entry.to)
                )
                .sort((a, b) => b.to.length - a.to.length)[0],
        [location.pathname]
    );

    if (!rootAdmin) {
        return <Navigate to={'/'} replace />;
    }

    // Animate between sections, but not between the tabs of a single server/node/egg.
    const sectionKey = location.pathname.split('/').slice(0, 4).join('/');

    return (
        <GuideProvider>
            <Shell
                nav={nav}
                primary={['/admin', '/admin/servers', '/admin/users', '/admin/nodes']}
                context={<AdminContextCard />}
                title={
                    <span className={'flex items-center gap-2 min-w-0'}>
                        <span className={'text-gray-400 font-medium hidden sm:inline'}>{t('Admin')}</span>
                        <span className={'text-gray-600 hidden sm:inline'}>/</span>
                        <span className={'truncate'}>{current?.label || t('Admin')}</span>
                    </span>
                }
            >
                <ErrorBoundary>
                    <Spinner.Suspense key={sectionKey}>
                        <Routes location={location}>
                            <Route index element={<Overview />} />
                            <Route path={'guides'} element={<GuideHub />} />
                            <Route path={'guides/:key'} element={<GuideView />} />
                            <Route path={'servers'} element={<Servers />} />
                            <Route path={'servers/new'} element={<ServerCreate />} />
                            <Route path={'servers/:id/*'} element={<ServerView />} />
                            <Route path={'users'} element={<Users />} />
                            <Route path={'users/:id'} element={<UserView />} />
                            <Route path={'nodes'} element={<Nodes />} />
                            <Route path={'nodes/new'} element={<NodeCreate />} />
                            <Route path={'nodes/:id/*'} element={<NodeView />} />
                            <Route path={'locations'} element={<Locations />} />
                            <Route path={'nests'} element={<Nests />} />
                            <Route path={'nests/eggs/new'} element={<EggCreate />} />
                            <Route path={'nests/eggs/:id/*'} element={<EggView />} />
                            <Route path={'databases'} element={<DatabaseHosts />} />
                            <Route path={'mounts'} element={<Mounts />} />
                            <Route path={'mounts/:id'} element={<MountView />} />
                            <Route path={'settings/*'} element={<Settings />} />
                            <Route path={'api'} element={<ApiKeys />} />
                            <Route path={'activity'} element={<AuditLog />} />
                            <Route path={'system'} element={<System />} />
                            <Route path={'updates'} element={<Updates />} />
                            <Route path={'*'} element={<NotFound />} />
                        </Routes>
                    </Spinner.Suspense>
                </ErrorBoundary>
            </Shell>
            <GuideDrawer />
            <Toaster />
        </GuideProvider>
    );
};
