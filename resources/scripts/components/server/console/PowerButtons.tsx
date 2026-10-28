import React, { useEffect, useState } from 'react';
import { Button } from '@/components/elements/button/index';
import Can from '@/components/elements/Can';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import { Dialog } from '@/components/elements/dialog';
import { PlayIcon, RefreshIcon, StopIcon } from '@heroicons/react/solid';
import { t } from '@/i18n';

interface PowerButtonProps {
    className?: string;
}

const POWER_BUTTON = 'flex-1 min-w-0 px-2 sm:px-4 flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm';

export default ({ className }: PowerButtonProps) => {
    const [open, setOpen] = useState(false);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    const killable = status === 'stopping';
    const onButtonClick = (
        action: PowerAction | 'kill-confirmed',
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ): void => {
        e.preventDefault();
        if (action === 'kill') {
            return setOpen(true);
        }

        if (instance) {
            setOpen(false);
            instance.send('set state', action === 'kill-confirmed' ? 'kill' : action);
        }
    };

    useEffect(() => {
        if (status === 'offline') {
            setOpen(false);
        }
    }, [status]);

    return (
        <div className={className}>
            {/* On phones the label goes under the icon, so long translations fit next to each other. */}
            <Dialog.Confirm
                open={open}
                hideCloseIcon
                onClose={() => setOpen(false)}
                title={t('Forcibly Stop Process')}
                confirm={t('Continue')}
                onConfirmed={onButtonClick.bind(this, 'kill-confirmed')}
            >
                {t('Forcibly stopping a server can lead to data corruption.')}
            </Dialog.Confirm>
            <Can action={'control.start'}>
                <Button
                    className={POWER_BUTTON}
                    disabled={status !== 'offline'}
                    onClick={onButtonClick.bind(this, 'start')}
                >
                    <PlayIcon />
                    {t('Start')}
                </Button>
            </Can>
            <Can action={'control.restart'}>
                <Button.Text className={POWER_BUTTON} disabled={!status} onClick={onButtonClick.bind(this, 'restart')}>
                    <RefreshIcon />
                    {t('Restart')}
                </Button.Text>
            </Can>
            <Can action={'control.stop'}>
                <Button.Danger
                    className={POWER_BUTTON}
                    disabled={status === 'offline'}
                    onClick={onButtonClick.bind(this, killable ? 'kill' : 'stop')}
                >
                    <StopIcon />
                    {killable ? t('Kill') : t('Stop')}
                </Button.Danger>
            </Can>
        </div>
    );
};
