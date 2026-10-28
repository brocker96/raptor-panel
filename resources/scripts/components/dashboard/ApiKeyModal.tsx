import React, { useContext } from 'react';
import { KeyIcon } from '@heroicons/react/outline';
import asModal from '@/hoc/asModal';
import ModalContext from '@/context/ModalContext';
import CopyField from '@/components/ui/CopyField';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { t } from '@/i18n';

interface Props {
    apiKey: string;
}

const ApiKeyModal = ({ apiKey }: Props) => {
    const { dismiss } = useContext(ModalContext);

    return (
        <div className={'space-y-4'}>
            <div className={'flex items-start gap-3.5'}>
                <span
                    className={
                        'grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl bg-raptor-500/10 text-raptor-400 ring-1 ring-inset ring-raptor-500/25'
                    }
                >
                    <KeyIcon className={'w-5 h-5'} />
                </span>
                <div>
                    <h3 className={'text-base font-semibold text-gray-50'}>{t('Your new API key')}</h3>
                    <p className={'mt-1 text-sm text-gray-400'}>{t('Copy it now and store it somewhere safe.')}</p>
                </div>
            </div>
            <CopyField label={t('API key')} value={apiKey} />
            <Callout tone={'yellow'}>
                {t('The key is shown only once. If you lose it, delete it and create a new one.')}
            </Callout>
            <div className={'flex justify-end'}>
                <Button onClick={() => dismiss()}>{t('I copied it')}</Button>
            </div>
        </div>
    );
};

ApiKeyModal.displayName = 'ApiKeyModal';

export default asModal<Props>({ closeOnEscape: false, closeOnBackground: false })(ApiKeyModal);
