import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { CubeIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerStartup from '@/api/swr/getServerStartup';
import setSelectedDockerImage from '@/api/server/setSelectedDockerImage';
import { SocketRequest } from '@/components/server/events';
import { usePermissions } from '@/plugins/usePermissions';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Skeleton } from '@/components/admin/ui/Feedback';
import { toast } from '@/components/admin/ui/Toast';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

const MATCH_ERRORS = [
    'minecraft 1.17 requires running the server with java 16 or above',
    'minecraft 1.18 requires running the server with java 17 or above',
    'java.lang.unsupportedclassversionerror',
    'unsupported major.minor version',
    'has been compiled by a more recent version of the java runtime',
];

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const current = ServerContext.useStoreState((state) => state.server.data!.dockerImage);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const [canChange] = usePermissions(['startup.docker-image']);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState('');
    const [busy, setBusy] = useState(false);
    const { data, mutate } = getServerStartup(uuid, null, { enabled: false });

    useConsoleMatch(MATCH_ERRORS, () => setOpen(true));

    useEffect(() => {
        if (!open) return;
        mutate().then((value) => setSelected(Object.values(value?.dockerImages || {})[0] || ''));
    }, [open]);

    const save = async () => {
        setBusy(true);
        try {
            await setSelectedDockerImage(uuid, selected);
            setServerFromState((s) => ({ ...s, dockerImage: selected }));
            if (status === 'offline' && instance) instance.send(SocketRequest.SET_STATE, 'restart');
            toast.success(t('Java version changed'), t('The server is starting.'));
            setOpen(false);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            busy={busy}
            tone={'warning'}
            icon={CubeIcon}
            title={t('This Java version is not supported')}
            description={
                canChange
                    ? t(
                          'The server or one of its plugins needs another Java version. Choose one and the server starts again.'
                      )
                    : t(
                          'The server or one of its plugins needs another Java version. Ask the owner of the server to change it in Startup.'
                      )
            }
            footer={
                <>
                    <Button variant={'secondary'} onClick={() => setOpen(false)} disabled={busy}>
                        {t('Close')}
                    </Button>
                    {canChange && (
                        <Button loading={busy} disabled={!selected} onClick={save}>
                            {t('Use this version')}
                        </Button>
                    )}
                </>
            }
        >
            {canChange &&
                (!data ? (
                    <Skeleton className={'h-32 rounded-xl'} />
                ) : (
                    <div className={'grid grid-cols-2 sm:grid-cols-3 gap-2'}>
                        {Object.entries(data.dockerImages).map(([label, value]) => (
                            <button
                                key={value}
                                type={'button'}
                                onClick={() => setSelected(value)}
                                className={classNames(
                                    'rounded-lg px-3 py-2.5 text-left text-sm ring-1 ring-inset transition-colors',
                                    selected === value
                                        ? 'bg-raptor-500/10 ring-raptor-500/50 text-gray-50'
                                        : 'ring-gray-800 text-gray-300 hover:ring-gray-600'
                                )}
                            >
                                {label}
                                {value === current && (
                                    <span className={'block text-[0.7rem] text-gray-500'}>{t('current')}</span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
        </Modal>
    );
};
