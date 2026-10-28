import React, { lazy, useEffect } from 'react';
import { createBrowserRouter, Route, RouterProvider, Routes, useNavigate } from 'react-router-dom';
import { StoreProvider } from 'easy-peasy';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/query';
import { store } from '@/state';
import { SiteSettings } from '@/state/settings';
import ProgressBar from '@/components/elements/ProgressBar';
import tw from 'twin.macro';
import GlobalStylesheet from '@/assets/css/GlobalStylesheet';
import { setNavigator } from '@/components/history';
import { setupInterceptors } from '@/api/interceptors';
import AuthenticatedRoute from '@/components/elements/AuthenticatedRoute';
import { ServerContext } from '@/state/server';
import '@/assets/tailwind.css';
import Spinner from '@/components/elements/Spinner';
import SecurityPrompts from '@/components/security/SecurityPrompts';
import { setLocked } from '@/plugins/securityPrompts';

const DashboardRouter = lazy(() => import('@/routers/DashboardRouter'));
const ServerRouter = lazy(() => import('@/routers/ServerRouter'));
const AdminRouter = lazy(() => import('@/routers/AdminRouter'));
const AuthenticationRouter = lazy(() => import('@/routers/AuthenticationRouter'));

interface ExtendedWindow extends Window {
    SiteConfiguration?: SiteSettings;
    RaptorUser?: {
        uuid: string;
        username: string;
        email: string;

        root_admin: boolean;
        use_totp: boolean;
        has_pin?: boolean;
        screen_lock_effective?: number | null;
        security_locked?: boolean;
        avatar_url?: string | null;
        language: string;
        updated_at: string;
        created_at: string;
    };
}

setupInterceptors();

const Root = () => {
    const navigate = useNavigate();

    useEffect(() => {
        setNavigator(navigate);

        return () => setNavigator(null);
    }, [navigate]);

    return (
        <Routes>
            <Route
                path={'/auth/*'}
                element={
                    <Spinner.Suspense>
                        <AuthenticationRouter />
                    </Spinner.Suspense>
                }
            />
            <Route
                path={'/server/:id/*'}
                element={
                    <AuthenticatedRoute>
                        <Spinner.Suspense>
                            <ServerContext.Provider>
                                <ServerRouter />
                            </ServerContext.Provider>
                        </Spinner.Suspense>
                    </AuthenticatedRoute>
                }
            />
            <Route
                path={'/admin/*'}
                element={
                    <AuthenticatedRoute>
                        <Spinner.Suspense>
                            <AdminRouter />
                        </Spinner.Suspense>
                    </AuthenticatedRoute>
                }
            />
            <Route
                path={'/*'}
                element={
                    <AuthenticatedRoute>
                        <Spinner.Suspense>
                            <DashboardRouter />
                        </Spinner.Suspense>
                    </AuthenticatedRoute>
                }
            />
        </Routes>
    );
};

const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

const App = () => {
    const { RaptorUser, SiteConfiguration } = window as ExtendedWindow;
    if (RaptorUser && !store.getState().user.data) {
        store.getActions().user.setUserData({
            uuid: RaptorUser.uuid,
            username: RaptorUser.username,
            email: RaptorUser.email,
            language: RaptorUser.language,
            rootAdmin: RaptorUser.root_admin,
            useTotp: RaptorUser.use_totp,
            hasPin: !!RaptorUser.has_pin,
            screenLockMinutes: RaptorUser.screen_lock_effective ?? null,
            avatarUrl: RaptorUser.avatar_url ?? null,
            createdAt: new Date(RaptorUser.created_at),
            updatedAt: new Date(RaptorUser.updated_at),
        });
    }

    if (RaptorUser?.security_locked) {
        setLocked(true, false);
    }

    if (!store.getState().settings.data) {
        store.getActions().settings.setSettings(SiteConfiguration!);
    }

    return (
        <>
            <GlobalStylesheet />
            <QueryClientProvider client={queryClient}>
                <StoreProvider store={store}>
                    <ProgressBar />
                    <div css={tw`mx-auto w-auto`}>
                        <RouterProvider router={router} />
                    </div>
                    <SecurityPrompts />
                </StoreProvider>
            </QueryClientProvider>
        </>
    );
};

export default App;
