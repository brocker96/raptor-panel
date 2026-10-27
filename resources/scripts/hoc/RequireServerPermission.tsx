import React from 'react';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

export interface RequireServerPermissionProps {
    permissions: string | string[];
}

const RequireServerPermission: React.FC<React.PropsWithChildren<RequireServerPermissionProps>> = ({
    children,
    permissions,
}) => {
    return (
        <Can
            action={permissions}
            renderOnError={
                <ServerError
                    title={t('Access Denied')}
                    message={t('You do not have permission to access this page.')}
                />
            }
        >
            {children}
        </Can>
    );
};

export default RequireServerPermission;
