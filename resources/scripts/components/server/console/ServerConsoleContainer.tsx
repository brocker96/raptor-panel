import React, { memo } from 'react';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import { lazyWithPreload } from '@/lib/lazy';
import PowerButtons from '@/components/server/console/PowerButtons';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';
import StatusDot, { statusLabel } from '@/components/server/StatusDot';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { ip } from '@/lib/formatters';
import { t } from '@/i18n';

// The terminal and the charts are the heaviest parts of the panel (xterm and chart.js), they are
// loaded separately so that the rest of the page renders immediately.
const Console = lazyWithPreload(() => import('@/components/server/console/Console'));
const StatGraphs = lazyWithPreload(() => import('@/components/server/console/StatGraphs'));

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const ServerConsoleContainer = () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const description = ServerContext.useStoreState((state) => state.server.data!.description);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);
    const address = ServerContext.useStoreState((state) => {
        const match = state.server.data!.allocations.find((allocation) => allocation.isDefault);

        return !match ? null : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    return (
        <ServerContentBlock title={t('Console')} hideHeading>
            {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                <Alert type={'warning'} className={'mb-4'}>
                    {isNodeUnderMaintenance
                        ? t('The node of this server is currently under maintenance and all actions are unavailable.')
                        : isInstalling
                        ? t(
                              'This server is currently running its installation process and most actions are unavailable.'
                          )
                        : t(
                              'This server is currently being transferred to another node and all actions are unavailable.'
                          )}
                </Alert>
            )}
            <div className={'flex flex-col sm:flex-row sm:items-end gap-4 mb-5'}>
                <div className={'flex-1 min-w-0'}>
                    <div className={'flex items-center gap-3 flex-wrap'}>
                        <h1 className={'text-2xl sm:text-3xl break-words'}>{name}</h1>
                        <span
                            className={
                                'inline-flex items-center gap-2 h-6 px-2.5 rounded-full text-xs font-medium bg-gray-900 ring-1 ring-inset ring-gray-800 text-gray-200'
                            }
                        >
                            <StatusDot status={status} className={'w-2 h-2'} />
                            {statusLabel(status)}
                        </span>
                    </div>
                    <div className={'mt-1.5 flex items-center gap-3 text-sm text-gray-400 min-w-0'}>
                        {address && (
                            <CopyOnClick text={address}>
                                <span className={'font-mono text-gray-300 hover:text-white cursor-pointer'}>
                                    {address}
                                </span>
                            </CopyOnClick>
                        )}
                        {description && <span className={'truncate hidden sm:inline'}>{description}</span>}
                    </div>
                </div>
                <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                    <PowerButtons className={'flex gap-2 sm:flex-none'} />
                </Can>
            </div>
            <ServerDetailsBlock className={'mb-4'} />
            <Spinner.Suspense>
                <Console />
            </Spinner.Suspense>
            <div className={'grid grid-cols-1 md:grid-cols-3 gap-3 mt-4'}>
                <Spinner.Suspense>
                    <StatGraphs />
                </Spinner.Suspense>
            </div>
            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
