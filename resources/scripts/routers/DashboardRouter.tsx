import React, { useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ServerIcon } from '@heroicons/react/outline';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import Spinner from '@/components/elements/Spinner';
import Shell, { NavEntry } from '@/components/layout/Shell';
import routes, { preload } from '@/routers/routes';
import { t } from '@/i18n';

const accountPath = (path: string) => `/account/${path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

export default () => {
    const location = useLocation();

    const nav = useMemo<NavEntry[]>(
        () => [
            { to: '/', label: t('Servers'), icon: ServerIcon, end: true },
            ...routes.account
                .filter((route) => !!route.name)
                .map((route) => ({
                    to: accountPath(route.path),
                    label: route.name!,
                    icon: route.icon,
                    end: route.exact ?? false,
                    linkProps: preload(route),
                })),
        ],
        []
    );

    const current = nav.find((entry) =>
        entry.end ? location.pathname === entry.to : location.pathname.startsWith(entry.to)
    );

    return (
        <Shell nav={nav} primary={['/', '/account', '/account/security', '/account/activity']} title={current?.label}>
            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
                    <Routes location={location}>
                        <Route path={'/'} element={<DashboardContainer />} />
                        {routes.account.map(({ path, component: Component }) => (
                            <Route key={path} path={accountPath(path)} element={<Component />} />
                        ))}
                        <Route path={'*'} element={<NotFound />} />
                    </Routes>
                </React.Suspense>
            </TransitionRouter>
        </Shell>
    );
};
