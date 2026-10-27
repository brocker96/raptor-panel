import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ChevronLeftIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import TransitionRouter from '@/TransitionRouter';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import InstallListener from '@/components/server/InstallListener';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import PermissionRoute from '@/components/elements/PermissionRoute';
import Shell, { NavEntry } from '@/components/layout/Shell';
import StatusDot from '@/components/server/StatusDot';
import routes, { preload } from '@/routers/routes';
import { checkPermissions } from '@/plugins/usePermissions';
import { whenIdle } from '@/lib/lazy';

const ServerContextCard = () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.internalId);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);

    return (
        <div className={'rounded-lg bg-gray-900 ring-1 ring-inset ring-gray-800 p-3'}>
            <Link
                to={'/'}
                className={'flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-200 no-underline'}
            >
                <ChevronLeftIcon className={'w-3.5 h-3.5'} />
                All servers
            </Link>
            <div className={'mt-2 flex items-center gap-2 min-w-0'}>
                <StatusDot status={status} />
                <p className={'flex-1 min-w-0 font-semibold text-gray-50 truncate'} title={name}>
                    {name}
                </p>
                {rootAdmin && (
                    <Link
                        to={`/admin/servers/${serverId}`}
                        className={'text-gray-500 hover:text-gray-200'}
                        title={'View in admin area'}
                    >
                        <ExternalLinkIcon className={'w-4 h-4'} />
                    </Link>
                )}
            </div>
            <p className={'mt-0.5 text-xs text-gray-500 truncate'}>{node}</p>
        </div>
    );
};

export default () => {
    const params = useParams<{ id: string }>();
    const location = useLocation();

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [error, setError] = useState('');

    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const name = ServerContext.useStoreState((state) => state.server.data?.name);
    const permissions = ServerContext.useStoreState((state) => state.server.permissions);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);

    // Absolute URL used for navigation links, and the path relative to "/server/:id" used for
    // matching the nested routes.
    const to = (value: string) => `/server/${params.id}/${value.replace(/^\/+/, '')}`.replace(/\/$/, '');
    const relative = (value: string) => value.replace(/^\/+/, '') || '/';

    useEffect(
        () => () => {
            clearServerState();
        },
        []
    );

    // Once the server has loaded and the browser is idle, download the most used screens ahead of
    // time so that switching to them does not show a loading spinner.
    useEffect(() => {
        if (!uuid) return;

        return whenIdle(() => {
            routes.server
                .filter((route) => ['/', '/files', '/files/:action'].includes(route.path))
                .forEach((route) => route.component.preload().catch(() => undefined));
        });
    }, [uuid]);

    useEffect(() => {
        setError('');

        getServer(params.id!).catch((error) => {
            console.error(error);
            setError(httpErrorToHuman(error));
        });

        return () => {
            clearServerState();
        };
    }, [params.id]);

    const nav = useMemo<NavEntry[]>(
        () =>
            routes.server
                .filter((route) => !!route.name)
                .filter((route) => !route.permission || checkPermissions(permissions, route.permission).some(Boolean))
                .map((route) => ({
                    to: to(route.path),
                    label: route.name!,
                    icon: route.icon,
                    end: route.exact,
                    linkProps: preload(route),
                })),
        [permissions, params.id]
    );

    // The name of the page being viewed, shown in the top bar.
    const current = nav
        .filter((entry) => location.pathname === entry.to || location.pathname.startsWith(entry.to + '/'))
        .sort((a, b) => b.to.length - a.to.length)[0];

    if (!uuid || !id) {
        return (
            <Shell nav={[]} title={null}>
                {error ? <ServerError message={error} /> : <Spinner size={'large'} centered />}
            </Shell>
        );
    }

    return (
        <Shell
            nav={nav}
            primary={['', 'files', 'backups', 'settings'].map((path) => to(path))}
            context={<ServerContextCard />}
            title={
                <span className={'flex items-center gap-2 min-w-0'}>
                    <span className={'truncate text-gray-400 font-medium hidden sm:inline'}>{name}</span>
                    <span className={'text-gray-600 hidden sm:inline'}>/</span>
                    <span className={'truncate'}>{current?.label || name}</span>
                </span>
            }
            banner={<WebsocketHandler />}
            fullscreen={/\/files\/(edit|new)$/.test(location.pathname)}
        >
            <InstallListener />
            <TransferListener />
            {inConflictState && (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                <ConflictStateRenderer />
            ) : (
                <ErrorBoundary>
                    <TransitionRouter>
                        <Routes location={location}>
                            {routes.server.map(({ path, permission, component: Component }) => (
                                <Route
                                    key={path}
                                    path={relative(path)}
                                    element={
                                        <PermissionRoute permission={permission}>
                                            <Spinner.Suspense>
                                                <Component />
                                            </Spinner.Suspense>
                                        </PermissionRoute>
                                    }
                                />
                            ))}
                            <Route path={'*'} element={<NotFound />} />
                        </Routes>
                    </TransitionRouter>
                </ErrorBoundary>
            )}
        </Shell>
    );
};
