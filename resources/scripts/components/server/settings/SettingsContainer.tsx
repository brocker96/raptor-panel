import React, { useEffect, useState } from 'react';
import isEqual from 'react-fast-compare';
import {
    CogIcon,
    ExternalLinkIcon,
    InformationCircleIcon,
    RefreshIcon,
    ServerIcon,
    TerminalIcon,
} from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import renameServer from '@/api/server/renameServer';
import reinstallServer from '@/api/server/reinstallServer';
import { usePermissions } from '@/plugins/usePermissions';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import CopyField from '@/components/ui/CopyField';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { TextArea, TextInput } from '@/components/admin/ui/Form';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { formatMb } from '@/components/admin/ui/hooks';
import { ip } from '@/lib/formatters';
import { t } from '@/i18n';

const Limit = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className={'rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 px-3 py-2.5'}>
        <p className={'text-xs text-gray-500'}>{label}</p>
        <p className={'mt-0.5 text-sm font-medium text-gray-100'}>{value}</p>
    </div>
);

const DetailsCard = () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const setServer = ServerContext.useStoreActions((actions) => actions.server.setServer);
    const [name, setName] = useState(server.name);
    const [description, setDescription] = useState(server.description || '');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setName(server.name);
        setDescription(server.description || '');
    }, [server.name, server.description]);

    const dirty = name !== server.name || description !== (server.description || '');

    const save = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            await renameServer(server.uuid, name.trim(), description);
            setServer({ ...server, name: name.trim(), description });
            toast.success(t('Server details saved'));
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card
            title={t('Name and description')}
            icon={ServerIcon}
            footer={
                <div className={'flex justify-end gap-2'}>
                    {dirty && (
                        <Button
                            variant={'ghost'}
                            onClick={() => {
                                setName(server.name);
                                setDescription(server.description || '');
                            }}
                        >
                            {t('Discard')}
                        </Button>
                    )}
                    <Button loading={busy} disabled={!dirty || !name.trim()} onClick={save}>
                        {t('Save')}
                    </Button>
                </div>
            }
        >
            <div className={'space-y-4'}>
                <TextInput label={t('Name')} value={name} onChange={setName} maxLength={191} required />
                <TextArea
                    label={t('Description')}
                    value={description}
                    onChange={setDescription}
                    rows={3}
                    description={t('Shown under the name in your server list.')}
                />
            </div>
        </Card>
    );
};

export default () => {
    const username = useStoreState((state) => state.user.data!.username);
    const server = ServerContext.useStoreState(
        ({ server }) => ({
            id: server.data!.id,
            uuid: server.data!.uuid,
            name: server.data!.name,
            node: server.data!.node,
            sftp: server.data!.sftpDetails,
            limits: server.data!.limits,
            featureLimits: server.data!.featureLimits,
            skipScripts: server.data!.skipScripts,
        }),
        isEqual
    );
    const [canSftp, canRename, canReinstall] = usePermissions(['file.sftp', 'settings.rename', 'settings.reinstall']);
    const [reinstalling, setReinstalling] = useState(false);
    const [busy, setBusy] = useState(false);

    const host = ip(server.sftp.ip);
    const user = `${username}.${server.id}`;

    const reinstall = async () => {
        setBusy(true);
        try {
            await reinstallServer(server.uuid);
            toast.success(t('Reinstall started'), t('Follow the progress in the console.'));
            setReinstalling(false);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const unlimited = t('Unlimited');

    return (
        <ServerContentBlock
            title={t('Settings')}
            icon={CogIcon}
            description={t('Access over SFTP, the details of the server and its plan.')}
        >
            <div className={'grid lg:grid-cols-2 gap-5 items-start'}>
                <div className={'space-y-5'}>
                    {canSftp && (
                        <Card
                            title={t('SFTP access')}
                            icon={TerminalIcon}
                            description={t('Upload large files with FileZilla, WinSCP or Cyberduck.')}
                            actions={
                                <Button
                                    variant={'secondary'}
                                    size={'sm'}
                                    icon={ExternalLinkIcon}
                                    onClick={() =>
                                        (window.location.href = `sftp://${user}@${host}:${server.sftp.port}`)
                                    }
                                >
                                    {t('Open client')}
                                </Button>
                            }
                        >
                            <div className={'grid sm:grid-cols-[minmax(0,1fr)_7rem] gap-3'}>
                                <CopyField label={t('Host')} value={host} />
                                <CopyField label={t('Port')} value={String(server.sftp.port)} />
                            </div>
                            <div className={'mt-3 grid gap-3'}>
                                <CopyField label={t('Username')} value={user} />
                                <CopyField label={t('Address')} value={`sftp://${user}@${host}:${server.sftp.port}`} />
                            </div>
                            <p className={'mt-3 flex items-start gap-2 text-xs text-gray-400'}>
                                <InformationCircleIcon className={'w-4 h-4 flex-shrink-0 text-sky-400'} />
                                {t(
                                    'The password is the same as your panel password. SSH keys from your account work too.'
                                )}
                            </p>
                        </Card>
                    )}
                    {canRename && <DetailsCard />}
                </div>
                <div className={'space-y-5'}>
                    <Card title={t('Plan')} description={t('Resources of this server, set by your hosting provider.')}>
                        <div className={'grid grid-cols-2 sm:grid-cols-3 gap-2'}>
                            <Limit
                                label={t('Memory')}
                                value={server.limits.memory ? formatMb(server.limits.memory) : unlimited}
                            />
                            <Limit
                                label={t('Disk')}
                                value={server.limits.disk ? formatMb(server.limits.disk) : unlimited}
                            />
                            <Limit label={t('CPU')} value={server.limits.cpu ? `${server.limits.cpu}%` : unlimited} />
                            <Limit
                                label={t('Swap')}
                                value={
                                    server.limits.swap === -1
                                        ? unlimited
                                        : server.limits.swap
                                        ? formatMb(server.limits.swap)
                                        : t('Off')
                                }
                            />
                            <Limit label={t('Databases')} value={server.featureLimits.databases} />
                            <Limit label={t('Backups')} value={server.featureLimits.backups} />
                            <Limit label={t('Ports')} value={server.featureLimits.allocations} />
                            {server.limits.threads && <Limit label={t('CPU threads')} value={server.limits.threads} />}
                        </div>
                    </Card>
                    <Card title={t('Technical details')} description={t('Useful when you contact support.')}>
                        <div className={'grid gap-3'}>
                            <CopyField label={t('Server ID')} value={server.uuid} />
                            <div className={'grid grid-cols-2 gap-3'}>
                                <CopyField label={t('Short ID')} value={server.id} />
                                <CopyField label={t('Node')} value={server.node} mono={false} />
                            </div>
                        </div>
                    </Card>
                    {canReinstall && (
                        <Card danger title={t('Reinstall')} icon={RefreshIcon}>
                            <p className={'text-sm text-gray-400'}>
                                {t(
                                    'Runs the install script of the egg again, for example to repair a broken install. Some files can be replaced or deleted, make a backup first.'
                                )}
                            </p>
                            {server.skipScripts && (
                                <div className={'mt-3'}>
                                    <Callout tone={'yellow'}>
                                        {t(
                                            'The install script is disabled for this server, a reinstall only restarts the install container.'
                                        )}
                                    </Callout>
                                </div>
                            )}
                            <div className={'mt-4'}>
                                <Button variant={'danger'} icon={RefreshIcon} onClick={() => setReinstalling(true)}>
                                    {t('Reinstall server')}
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
            <Confirm
                open={reinstalling}
                title={t('Reinstall {{name}}?', { name: server.name })}
                confirm={t('Reinstall')}
                challenge={server.name}
                loading={busy}
                onConfirm={reinstall}
                onClose={() => setReinstalling(false)}
            >
                {t(
                    'The server is stopped and the install script runs again. Some files can be overwritten or deleted.'
                )}
            </Confirm>
        </ServerContentBlock>
    );
};
