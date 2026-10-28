import React, { useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import saveFileContents from '@/api/server/files/saveFileContents';
import { SocketRequest } from '@/components/server/events';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { toast } from '@/components/admin/ui/Toast';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    useConsoleMatch(['you need to agree to the eula in order to run the server'], () => setOpen(true));

    const accept = async () => {
        setBusy(true);
        try {
            await saveFileContents(uuid, 'eula.txt', 'eula=true');
            if (status === 'offline' && instance) instance.send(SocketRequest.SET_STATE, 'restart');
            toast.success(t('EULA accepted'), t('The server is starting.'));
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
            icon={DocumentTextIcon}
            title={t('Accept the Minecraft® EULA')}
            description={t('Minecraft servers only start after the end user license agreement has been accepted.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={() => setOpen(false)} disabled={busy}>
                        {t('Not now')}
                    </Button>
                    <Button loading={busy} onClick={accept}>
                        {t('Accept and start')}
                    </Button>
                </>
            }
        >
            <p className={'text-sm text-gray-300 leading-relaxed'}>
                {t('By accepting you agree to the')}{' '}
                <a
                    href={'https://www.minecraft.net/eula'}
                    target={'_blank'}
                    rel={'noreferrer noopener'}
                    className={'text-raptor-400 underline hover:text-raptor-300'}
                >
                    {t('Minecraft® EULA')}
                </a>
                . {t('Raptor writes eula=true into eula.txt and starts the server for you.')}
            </p>
        </Modal>
    );
};
