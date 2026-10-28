import React, { useState } from 'react';
import { DatabaseIcon } from '@heroicons/react/outline';
import { useStoreState } from '@/state/hooks';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

export default () => {
    const isAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [open, setOpen] = useState(false);

    useConsoleMatch(['steamcmd needs 250mb of free disk space to update', '0x202 after update job'], () =>
        setOpen(true)
    );

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            tone={'warning'}
            icon={DatabaseIcon}
            title={t('Out of disk space')}
            description={t('SteamCMD needs free disk space to install or update the server.')}
            footer={<Button onClick={() => setOpen(false)}>{t('Close')}</Button>}
        >
            <p className={'text-sm text-gray-300 leading-relaxed'}>
                {isAdmin ? (
                    <>
                        {t('Check the free space of the node with')}{' '}
                        <code className={'rounded bg-gray-950 px-1.5 py-0.5 text-xs'}>df -h</code>
                        {', '}
                        {t('then delete files or raise the disk limit of the server.')}
                    </>
                ) : (
                    t('Delete files you do not need, or ask your hosting provider for more disk space.')
                )}
            </p>
        </Modal>
    );
};
