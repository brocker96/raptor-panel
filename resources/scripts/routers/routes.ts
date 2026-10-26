import { lazyWithPreload, PreloadableComponent } from '@/lib/lazy';
// Every screen is lazy loaded so that each page only downloads the code it needs. This is
// especially important as this file is shared by both the dashboard and server routers, a
// static import here would make the dashboard download the console, charts and editor.
const ServerConsole = lazyWithPreload(() => import('@/components/server/console/ServerConsoleContainer'));
const DatabasesContainer = lazyWithPreload(() => import('@/components/server/databases/DatabasesContainer'));
const ScheduleContainer = lazyWithPreload(() => import('@/components/server/schedules/ScheduleContainer'));
const UsersContainer = lazyWithPreload(() => import('@/components/server/users/UsersContainer'));
const BackupContainer = lazyWithPreload(() => import('@/components/server/backups/BackupContainer'));
const NetworkContainer = lazyWithPreload(() => import('@/components/server/network/NetworkContainer'));
const StartupContainer = lazyWithPreload(() => import('@/components/server/startup/StartupContainer'));
const FileManagerContainer = lazyWithPreload(() => import('@/components/server/files/FileManagerContainer'));
const SettingsContainer = lazyWithPreload(() => import('@/components/server/settings/SettingsContainer'));
const AccountOverviewContainer = lazyWithPreload(() => import('@/components/dashboard/AccountOverviewContainer'));
const AccountApiContainer = lazyWithPreload(() => import('@/components/dashboard/AccountApiContainer'));
const AccountSSHContainer = lazyWithPreload(() => import('@/components/dashboard/ssh/AccountSSHContainer'));
const ActivityLogContainer = lazyWithPreload(() => import('@/components/dashboard/activity/ActivityLogContainer'));
const ServerActivityLogContainer = lazyWithPreload(() => import('@/components/server/ServerActivityLogContainer'));
const FileEditContainer = lazyWithPreload(() => import('@/components/server/files/FileEditContainer'));
const ScheduleEditContainer = lazyWithPreload(() => import('@/components/server/schedules/ScheduleEditContainer'));

interface RouteDefinition {
    path: string;
    // If undefined is passed this route is still rendered into the router itself
    // but no navigation link is displayed in the sub-navigation menu.
    name: string | undefined;
    component: PreloadableComponent<any>;
    exact?: boolean;
}

interface ServerRouteDefinition extends RouteDefinition {
    permission: string | string[] | null;
}

interface Routes {
    // All of the routes available under "/account"
    account: RouteDefinition[];
    // All of the routes available under "/server/:id"
    server: ServerRouteDefinition[];
}

/**
 * Props for a link pointing at the given route which start downloading the route's code as soon as
 * the user shows intent to open it (hovering, focusing or touching the link).
 */
export const preload = (route: RouteDefinition) => {
    const start = () => {
        route.component.preload().catch(() => undefined);
    };

    return { onMouseEnter: start, onFocus: start, onTouchStart: start };
};

export default {
    account: [
        {
            path: '/',
            name: 'Account',
            component: AccountOverviewContainer,
            exact: true,
        },
        {
            path: '/api',
            name: 'API Credentials',
            component: AccountApiContainer,
        },
        {
            path: '/ssh',
            name: 'SSH Keys',
            component: AccountSSHContainer,
        },
        {
            path: '/activity',
            name: 'Activity',
            component: ActivityLogContainer,
        },
    ],
    server: [
        {
            path: '/',
            permission: null,
            name: 'Console',
            component: ServerConsole,
            exact: true,
        },
        {
            path: '/files',
            permission: 'file.*',
            name: 'Files',
            component: FileManagerContainer,
        },
        {
            path: '/files/:action',
            permission: 'file.*',
            name: undefined,
            component: FileEditContainer,
        },
        {
            path: '/databases',
            permission: 'database.*',
            name: 'Databases',
            component: DatabasesContainer,
        },
        {
            path: '/schedules',
            permission: 'schedule.*',
            name: 'Schedules',
            component: ScheduleContainer,
        },
        {
            path: '/schedules/:id',
            permission: 'schedule.*',
            name: undefined,
            component: ScheduleEditContainer,
        },
        {
            path: '/users',
            permission: 'user.*',
            name: 'Users',
            component: UsersContainer,
        },
        {
            path: '/backups',
            permission: 'backup.*',
            name: 'Backups',
            component: BackupContainer,
        },
        {
            path: '/network',
            permission: 'allocation.*',
            name: 'Network',
            component: NetworkContainer,
        },
        {
            path: '/startup',
            permission: 'startup.*',
            name: 'Startup',
            component: StartupContainer,
        },
        {
            path: '/settings',
            permission: ['settings.*', 'file.sftp'],
            name: 'Settings',
            component: SettingsContainer,
        },
        {
            path: '/activity',
            permission: 'activity.*',
            name: 'Activity',
            component: ServerActivityLogContainer,
        },
    ],
} as Routes;
