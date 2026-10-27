import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import reinstallServer from '@/api/server/reinstallServer';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import { t } from '@/i18n';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const skipScripts = ServerContext.useStoreState((state) => state.server.data!.skipScripts);
    const [modalVisible, setModalVisible] = useState(false);
    const { addFlash, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const reinstall = () => {
        clearFlashes('settings');
        reinstallServer(uuid)
            .then(() => {
                addFlash({
                    key: 'settings',
                    type: 'success',
                    message: t('Your server has begun the reinstallation process.'),
                });
            })
            .catch((error) => {
                console.error(error);

                addFlash({ key: 'settings', type: 'error', message: httpErrorToHuman(error) });
            })
            .then(() => setModalVisible(false));
    };

    useEffect(() => {
        clearFlashes();
    }, []);

    if (skipScripts) {
        return (
            <TitledGreyBox title={t('Reinstall Server')}>
                <p css={tw`text-sm`}>
                    {t(
                        "Reinstalling this server has been disabled because it is configured to skip its egg's install script. If you would like to reinstall this server, contact a server administrator."
                    )}
                </p>
            </TitledGreyBox>
        );
    }

    return (
        <TitledGreyBox title={t('Reinstall Server')} css={tw`relative`}>
            <Dialog.Confirm
                open={modalVisible}
                title={t('Confirm server reinstallation')}
                confirm={t('Yes, reinstall server')}
                onClose={() => setModalVisible(false)}
                onConfirmed={reinstall}
            >
                {t(
                    'Your server will be stopped and some files may be deleted or modified during this process, are you sure you wish to continue?'
                )}
            </Dialog.Confirm>
            <p css={tw`text-sm`}>
                {t(
                    'Reinstalling your server will stop it, and then re-run the installation script that initially set it up. '
                )}
                <strong css={tw`font-medium`}>
                    {t(
                        'Some files may be deleted or modified during this process, please back up your data before continuing.'
                    )}
                </strong>
            </p>
            <div css={tw`mt-6 text-right`}>
                <Button.Danger variant={Button.Variants.Secondary} onClick={() => setModalVisible(true)}>
                    {t('Reinstall Server')}
                </Button.Danger>
            </div>
        </TitledGreyBox>
    );
};
