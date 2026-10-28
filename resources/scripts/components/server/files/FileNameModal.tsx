import React, { useEffect, useState } from 'react';
import { join } from 'pathe';
import { DocumentAddIcon } from '@heroicons/react/outline';
import { RequiredModalProps } from '@/components/elements/Modal';
import { ServerContext } from '@/state/server';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { TextInput } from '@/components/admin/ui/Form';
import { t } from '@/i18n';

type Props = RequiredModalProps & {
    onFileNamed: (name: string) => void;
};

export default ({ onFileNamed, onDismissed, visible }: Props) => {
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const [name, setName] = useState('');

    useEffect(() => {
        if (visible) setName('');
    }, [visible]);

    const submit = () => name.trim() && onFileNamed(join(directory, name.trim()));

    return (
        <Modal
            open={visible}
            onClose={onDismissed}
            icon={DocumentAddIcon}
            title={t('Save as new file')}
            description={<span className={'font-mono'}>/home/container{join('/', directory)}</span>}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onDismissed}>
                        {t('Cancel')}
                    </Button>
                    <Button disabled={!name.trim()} onClick={submit}>
                        {t('Create file')}
                    </Button>
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <TextInput
                    label={t('File name')}
                    value={name}
                    onChange={setName}
                    placeholder={'config.yml'}
                    autoFocus
                    className={'font-mono'}
                />
            </form>
        </Modal>
    );
};
