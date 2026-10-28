import React, { useState } from 'react';
import { ExclamationIcon } from '@heroicons/react/outline';
import { useStoreState } from '@/state/hooks';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

const ERRORS = [
    'pthread_create failed',
    'failed to create thread',
    'unable to create thread',
    'unable to create native thread',
    'unable to create new native thread',
    'exception in thread "craft async scheduler management thread"',
];

export default () => {
    const isAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [open, setOpen] = useState(false);

    useConsoleMatch(ERRORS, () => setOpen(true));

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            tone={'warning'}
            icon={ExclamationIcon}
            title={isAdmin ? t('Process or memory limit reached') : t('The server ran out of resources')}
            description={
                isAdmin
                    ? t('The server could not create more threads, the container hit its process or memory limit.')
                    : t(
                          'The server tried to use more resources than it is allowed to. Send the error below to your hosting provider.'
                      )
            }
            footer={<Button onClick={() => setOpen(false)}>{t('Close')}</Button>}
        >
            {isAdmin ? (
                <div className={'space-y-3 text-sm text-gray-300 leading-relaxed'}>
                    <p>
                        {t('Raise')}{' '}
                        <code className={'rounded bg-gray-950 px-1.5 py-0.5 text-xs'}>container_pid_limit</code>{' '}
                        {t('in the Wings configuration')}{' '}
                        <code className={'rounded bg-gray-950 px-1.5 py-0.5 text-xs'}>/etc/pterodactyl/config.yml</code>{' '}
                        {t('or give the server more memory.')}
                    </p>
                    <p className={'text-gray-400'}>
                        {t('Wings must be restarted for changes of its configuration to apply.')}
                    </p>
                </div>
            ) : (
                <pre
                    className={
                        'rounded-lg bg-gray-950/60 px-3 py-2 font-mono text-xs text-gray-300 whitespace-pre-wrap'
                    }
                >
                    pthread_create failed, possibly out of memory or process/resource limits reached
                </pre>
            )}
        </Modal>
    );
};
