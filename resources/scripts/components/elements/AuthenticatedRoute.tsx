import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStoreState } from '@/state/hooks';

export default ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const isAuthenticated = useStoreState((state) => !!state.user.data?.uuid);

    if (!isAuthenticated) {
        return <Navigate to={'/auth/login'} state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
