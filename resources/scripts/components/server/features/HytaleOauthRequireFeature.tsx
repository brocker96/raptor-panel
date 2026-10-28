import React, { useState } from 'react';
import { ExternalLinkIcon, LoginIcon } from '@heroicons/react/outline';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import useConsoleMatch from '@/components/server/features/useConsoleMatch';
import { t } from '@/i18n';

const LINK = /https:\/\/oauth\.accounts\.hytale\.com\/oauth2\/device\/verify\?user_code=[\w-]+/i;

export default () => {
    const [link, setLink] = useState('');

    useConsoleMatch([LINK], (_, match) => setLink(match));

    const login = () => {
        window.open(link, '_blank', 'noopener,noreferrer');
        setLink('');
    };

    return (
        <Modal
            open={!!link}
            onClose={() => setLink('')}
            icon={LoginIcon}
            title={t('Sign in with Hytale')}
            description={t('The server needs your Hytale account to download or update its files.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={() => setLink('')}>
                        {t('Not now')}
                    </Button>
                    <Button icon={ExternalLinkIcon} onClick={login}>
                        {t('Sign in')}
                    </Button>
                </>
            }
        >
            <p className={'text-sm text-gray-300'}>
                {t('A Hytale page opens in a new tab, confirm the code there and come back.')}
            </p>
            <p className={'mt-2 font-mono text-xs text-gray-500 break-all'}>{link}</p>
        </Modal>
    );
};
