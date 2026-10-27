import React from 'react';
import { ServerContext } from '@/state/server';
import ScreenBlock from '@/components/elements/ScreenBlock';
import ServerInstallSvg from '@/assets/images/server_installing.svg';
import ServerErrorSvg from '@/assets/images/server_error.svg';
import ServerRestoreSvg from '@/assets/images/server_restore.svg';
import { t } from '@/i18n';

export default () => {
    const status = ServerContext.useStoreState((state) => state.server.data?.status || null);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data?.isTransferring || false);
    const isNodeUnderMaintenance = ServerContext.useStoreState(
        (state) => state.server.data?.isNodeUnderMaintenance || false
    );

    return status === 'installing' || status === 'install_failed' || status === 'reinstall_failed' ? (
        <ScreenBlock
            title={t('Running Installer')}
            image={ServerInstallSvg}
            message={t('Your server should be ready soon, please try again in a few minutes.')}
        />
    ) : status === 'suspended' ? (
        <ScreenBlock
            title={t('Server Suspended')}
            image={ServerErrorSvg}
            message={t('This server is suspended and cannot be accessed.')}
        />
    ) : isNodeUnderMaintenance ? (
        <ScreenBlock
            title={t('Node under Maintenance')}
            image={ServerErrorSvg}
            message={t('The node of this server is currently under maintenance.')}
        />
    ) : (
        <ScreenBlock
            title={isTransferring ? t('Transferring') : t('Restoring from Backup')}
            image={ServerRestoreSvg}
            message={
                isTransferring
                    ? t('Your server is being transferred to a new node, please check back later.')
                    : t('Your server is currently being restored from a backup, please check back in a few minutes.')
            }
        />
    );
};
