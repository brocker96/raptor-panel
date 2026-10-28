import React, { useEffect, useState } from 'react';
import { join } from 'pathe';
import { FolderIcon, PencilIcon } from '@heroicons/react/outline';
import renameFiles from '@/api/server/files/renameFiles';
import { useFileManagerMutate } from '@/plugins/useFileManagerSwr';
import { RequiredModalProps } from '@/components/elements/Modal';
import { ServerContext } from '@/state/server';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { TextInput } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import { t } from '@/i18n';

type OwnProps = RequiredModalProps & { files: string[]; useMoveTerminology?: boolean };

const RenameFileModal = ({ files, useMoveTerminology, visible, onDismissed }: OwnProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const mutate = useFileManagerMutate();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (visible) setName(files.length > 1 ? '' : files[0] || '');
    }, [visible]);

    const submit = async () => {
        if (!name.trim()) return;
        setBusy(true);
        const parts = name.split('/').length;

        if (files.length === 1) {
            if (!useMoveTerminology && parts === 1) {
                mutate((data) => data?.map((f) => (f.name === files[0] ? { ...f, name } : f)), false);
            } else {
                mutate((data) => data?.filter((f) => f.name !== files[0]), false);
            }
        }

        const data =
            useMoveTerminology && files.length > 1
                ? files.map((f) => ({ from: f, to: join(name, f) }))
                : files.map((f) => ({ from: f, to: name }));

        try {
            await renameFiles(uuid, directory, data);
            await mutate();
            setSelectedFiles([]);
            toast.success(useMoveTerminology ? t('Moved') : t('Renamed'), name);
            onDismissed();
        } catch (err) {
            mutate();
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const target = join(directory, name).replace(/^(\.\.\/|\/)+/, '');

    return (
        <Modal
            open={visible}
            onClose={onDismissed}
            busy={busy}
            icon={useMoveTerminology ? FolderIcon : PencilIcon}
            title={useMoveTerminology ? t('Move') : t('Rename')}
            description={
                files.length === 1 ? (
                    <span className={'font-mono break-all'}>{files[0]}</span>
                ) : (
                    t('{{count}} files', { count: files.length })
                )
            }
            footer={
                <>
                    <Button variant={'secondary'} onClick={onDismissed} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button loading={busy} disabled={!name.trim()} onClick={submit}>
                        {useMoveTerminology ? t('Move') : t('Rename')}
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
                    label={useMoveTerminology ? t('Destination') : t('New name')}
                    value={name}
                    onChange={setName}
                    autoFocus
                    className={'font-mono'}
                    placeholder={useMoveTerminology ? 'plugins/old/' : undefined}
                    description={
                        useMoveTerminology ? (
                            <>
                                {t('Relative to the current folder, use ../ to go up.')}{' '}
                                <span className={'font-mono text-gray-300'}>/home/container/{target}</span>
                            </>
                        ) : undefined
                    }
                />
            </form>
        </Modal>
    );
};

export default RenameFileModal;
