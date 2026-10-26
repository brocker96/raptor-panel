import React from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import NavigationBar from '@/components/NavigationBar';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import SubNavigation from '@/components/elements/SubNavigation';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';

const accountPath = (path: string) => `/account/${path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

export default () => {
    const location = useLocation();

    return (
        <>
            <NavigationBar />
            {location.pathname.startsWith('/account') && (
                <SubNavigation>
                    <div>
                        {routes.account
                            .filter((route) => !!route.name)
                            .map(({ path, name, exact = false }) => (
                                <NavLink key={path} to={accountPath(path)} end={exact}>
                                    {name}
                                </NavLink>
                            ))}
                    </div>
                </SubNavigation>
            )}
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
        </>
    );
};
