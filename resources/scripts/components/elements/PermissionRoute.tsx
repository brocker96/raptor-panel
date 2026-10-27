import React from 'react';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

interface Props {
    permission: string | string[] | null;
    children: React.ReactNode;
}

export default ({ permission, children }: Props) =>
    !permission ? (
        <>{children}</>
    ) : (
        <Can
            matchAny
            action={permission}
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
