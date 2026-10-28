import React, { useState } from 'react';
import { KeyIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import { SocketRequest } from '@/components/server/events';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { TextInput } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const [open, setOpen] = useState(false);
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);

    useConsoleMatch(['(gsl token expired)', '(account not found)'], () => setOpen(true));

    const save = async () => {
        setBusy(true);
        try {
            await updateStartupVariable(uuid, 'STEAM_ACC', token.trim());
            instance?.send(SocketRequest.SET_STATE, 'restart');
            toast.success(token ? t('Token saved') : t('Token removed'), t('The server is restarting.'));
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
            icon={KeyIcon}
            title={t('The GSL token is invalid')}
            description={t('Steam rejected the Game Server Login Token of this server, it probably expired.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={() => setOpen(false)} disabled={busy}>
                        {t('Not now')}
                    </Button>
                    <Button loading={busy} onClick={save}>
                        {token ? t('Save and restart') : t('Remove token and restart')}
                    </Button>
                </>
            }
        >
            <TextInput
                label={t('New GSL token')}
                value={token}
                onChange={setToken}
                autoFocus
                className={'font-mono'}
                description={
                    <>
                        {t('Generate one at')}{' '}
                        <a
                            href={'https://steamcommunity.com/dev/managegameservers'}
                            target={'_blank'}
                            rel={'noreferrer noopener'}
                            className={'text-raptor-400 underline'}
                        >
                            steamcommunity.com/dev/managegameservers
                        </a>
                        . {t('Leave it empty to remove the token.')}
                    </>
                }
            />
        </Modal>
    );
};
