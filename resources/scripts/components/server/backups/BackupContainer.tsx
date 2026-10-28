import React, { useContext, useEffect, useState } from 'react';
import classNames from 'classnames';
import { format } from 'date-fns';
import {
    ArchiveIcon,
    CloudDownloadIcon,
    ExclamationIcon,
    LockClosedIcon,
    LockOpenIcon,
    PlusIcon,
    ReplyIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerBackups, { Context as ServerBackupContext } from '@/api/swr/getServerBackups';
import createServerBackup from '@/api/server/backups/createServerBackup';
import deleteBackup from '@/api/server/backups/deleteBackup';
import getBackupDownloadUrl from '@/api/server/backups/getBackupDownloadUrl';
import { restoreServerBackup } from '@/api/server/backups';
import http, { httpErrorToHuman } from '@/api/http';
import { ServerBackup } from '@/api/server/types';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { SocketEvent } from '@/components/server/events';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Modal from '@/components/ui/Modal';
import Menu from '@/components/ui/Menu';
import Pager from '@/components/ui/Pager';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, EmptyState, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { ago, formatBytes } from '@/components/admin/ui/hooks';
import { usePermissions } from '@/plugins/usePermissions';
import { t } from '@/i18n';

const SUGGESTED_IGNORES = ['logs/', 'cache/', '*.log', 'crash-reports/', '*.jar', 'plugins/dynmap/web/tiles/'];

const CreateBackupModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = getServerBackups();
    const [canLock] = usePermissions(['backup.delete']);
    const [name, setName] = useState('');
    const [ignored, setIgnored] = useState('');
    const [locked, setLocked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setName('');
        setIgnored('');
        setLocked(false);
        setError('');
    }, [open]);

    const lines = ignored.split('\n').map((l) => l.trim());
    const toggleIgnore = (rule: string) =>
        setIgnored((value) => {
            const rules = value
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);

            return (rules.includes(rule) ? rules.filter((r) => r !== rule) : [...rules, rule]).join('\n');
        });

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const backup = await createServerBackup(uuid, { name, ignored, isLocked: locked });
            await mutate(
                (data) => data && { ...data, items: data.items.concat(backup), backupCount: data.backupCount + 1 },
                false
            );
            toast.success(t('Backup started'), t('You can keep playing, it runs in the background.'));
            onClose();
        } catch (err) {
            setError(httpErrorToHuman(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            icon={ArchiveIcon}
            title={t('Create a backup')}
            description={t(
                'A compressed snapshot of every file of the server that can be restored or downloaded later.'
            )}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button icon={ArchiveIcon} loading={busy} onClick={submit}>
                        {t('Start backup')}
                    </Button>
                </>
            }
        >
            <div className={'space-y-4'}>
                {error && <Callout tone={'red'}>{error}</Callout>}
                <TextInput
                    label={t('Name')}
                    value={name}
                    onChange={setName}
                    placeholder={t('Before the 1.21 update')}
                    description={t('Optional, a name helps to find the backup later.')}
                    maxLength={191}
                    autoFocus
                />
                <div>
                    <TextArea
                        label={t('Files to skip')}
                        value={ignored}
                        onChange={setIgnored}
                        mono
                        rows={4}
                        placeholder={'logs/\n*.log'}
                        description={t(
                            'One rule per line, * works as a wildcard and ! in front of a rule includes it again. Leave it empty to use the .pteroignore file of the server.'
                        )}
                    />
                    <div className={'mt-2 flex flex-wrap gap-1.5'}>
                        {SUGGESTED_IGNORES.map((rule) => (
                            <button
                                key={rule}
                                type={'button'}
                                onClick={() => toggleIgnore(rule)}
                                className={classNames(
                                    'px-2 py-1 rounded-md font-mono text-[0.7rem] ring-1 ring-inset transition-colors',
                                    lines.includes(rule)
                                        ? 'bg-raptor-500/15 text-raptor-200 ring-raptor-500/30'
                                        : 'text-gray-400 ring-gray-700 hover:text-gray-100'
                                )}
                            >
                                {rule}
                            </button>
                        ))}
                    </div>
                </div>
                {canLock && (
                    <Toggle
                        label={t('Lock this backup')}
                        description={t(
                            'A locked backup cannot be deleted, neither by hand nor when old backups are rotated out.'
                        )}
                        checked={locked}
                        onChange={setLocked}
                    />
                )}
            </div>
        </Modal>
    );
};

const RestoreModal = ({ backup, onClose }: { backup: ServerBackup | null; onClose: () => void }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const [truncate, setTruncate] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => setTruncate(false), [backup]);

    const restore = async () => {
        if (!backup) return;
        setBusy(true);
        try {
            await restoreServerBackup(uuid, backup.uuid, truncate);
            setServerFromState((s) => ({ ...s, status: 'restoring_backup' }));
            toast.success(t('Restore started'), backup.name);
            onClose();
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={!!backup}
            onClose={onClose}
            busy={busy}
            tone={'warning'}
            icon={ReplyIcon}
            title={t('Restore {{name}}?', { name: backup?.name })}
            description={t(
                'The server is stopped while the files are restored. Power controls, files and backups are unavailable until it finishes.'
            )}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button variant={truncate ? 'danger' : 'primary'} icon={ReplyIcon} loading={busy} onClick={restore}>
                        {t('Restore backup')}
                    </Button>
                </>
            }
        >
            <Toggle
                label={t('Delete all current files first')}
                description={t(
                    'The server folder is emptied before restoring, so files created after the backup disappear. Otherwise they are kept and older versions are overwritten.'
                )}
                checked={truncate}
                onChange={setTruncate}
            />
            {backup && (
                <p className={'mt-4 text-xs text-gray-500'}>
                    {t('Backup from {{date}}', { date: format(backup.createdAt, 'PPpp') })} ·{' '}
                    {formatBytes(backup.bytes)}
                </p>
            )}
        </Modal>
    );
};

const BackupCard = ({
    backup,
    onRestore,
    onDelete,
    onToggleLock,
}: {
    backup: ServerBackup;
    onRestore: () => void;
    onDelete: () => void;
    onToggleLock: () => void;
}) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = getServerBackups();
    const [canDownload, canRestore, canDelete] = usePermissions(['backup.download', 'backup.restore', 'backup.delete']);

    useWebsocketEvent(`${SocketEvent.BACKUP_COMPLETED}:${backup.uuid}` as SocketEvent, (data) => {
        try {
            const parsed = JSON.parse(data);
            mutate(
                (current) =>
                    current && {
                        ...current,
                        items: current.items.map((b) =>
                            b.uuid !== backup.uuid
                                ? b
                                : {
                                      ...b,
                                      isSuccessful: parsed.is_successful ?? true,
                                      checksum: (parsed.checksum_type || '') + ':' + (parsed.checksum || ''),
                                      bytes: parsed.file_size || 0,
                                      completedAt: new Date(),
                                  }
                        ),
                    },
                false
            );
        } catch (e) {
            console.warn(e);
        }
    });

    const download = async () => {
        try {
            window.location.href = await getBackupDownloadUrl(uuid, backup.uuid);
        } catch (err) {
            toast.fromError(err);
        }
    };

    const running = backup.completedAt === null;
    const failed = !running && !backup.isSuccessful;

    return (
        <li className={'flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4'}>
            <div className={'flex items-center gap-3 min-w-0 flex-1'}>
                <span
                    className={classNames(
                        'relative grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl ring-1 ring-inset',
                        failed
                            ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
                            : backup.isLocked
                            ? 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                            : 'bg-raptor-500/10 text-raptor-300 ring-raptor-500/20'
                    )}
                >
                    {failed ? (
                        <ExclamationIcon className={'w-5 h-5'} />
                    ) : backup.isLocked ? (
                        <LockClosedIcon className={'w-5 h-5'} />
                    ) : (
                        <ArchiveIcon className={classNames('w-5 h-5', running && 'animate-pulse')} />
                    )}
                </span>
                <div className={'min-w-0'}>
                    <p className={'flex flex-wrap items-center gap-2 text-sm text-gray-50'}>
                        <span className={'break-all'}>{backup.name}</span>
                        {running && (
                            <Badge tone={'blue'} dot>
                                {t('In progress')}
                            </Badge>
                        )}
                        {failed && <Badge tone={'red'}>{t('Failed')}</Badge>}
                        {backup.isLocked && <Badge tone={'yellow'}>{t('Locked')}</Badge>}
                    </p>
                    <p className={'mt-0.5 text-xs text-gray-500'} title={format(backup.createdAt, 'PPpp')}>
                        {ago(backup.createdAt.toISOString())}
                        {!running && backup.isSuccessful && <> · {formatBytes(backup.bytes)}</>}
                    </p>
                    {backup.checksum && !running && (
                        <p
                            className={
                                'mt-0.5 font-mono text-[0.65rem] text-gray-600 truncate max-w-[18rem] sm:max-w-md'
                            }
                            title={backup.checksum}
                        >
                            {backup.checksum}
                        </p>
                    )}
                </div>
            </div>
            {!running && (
                <div className={'flex items-center gap-1.5'}>
                    {backup.isSuccessful && canDownload && (
                        <Button
                            variant={'secondary'}
                            size={'sm'}
                            icon={CloudDownloadIcon}
                            onClick={download}
                            className={'flex-1 sm:flex-none'}
                        >
                            {t('Download')}
                        </Button>
                    )}
                    {backup.isSuccessful && canRestore && (
                        <Button
                            variant={'secondary'}
                            size={'sm'}
                            icon={ReplyIcon}
                            onClick={onRestore}
                            className={'flex-1 sm:flex-none'}
                        >
                            {t('Restore')}
                        </Button>
                    )}
                    <Menu
                        items={[
                            {
                                label: backup.isLocked ? t('Unlock') : t('Lock'),
                                icon: backup.isLocked ? LockOpenIcon : LockClosedIcon,
                                onClick: onToggleLock,
                                hidden: !canDelete || !backup.isSuccessful,
                            },
                            {
                                label: t('Delete'),
                                icon: TrashIcon,
                                danger: true,
                                onClick: onDelete,
                                disabled: backup.isLocked,
                                hidden: !canDelete,
                            },
                        ]}
                    />
                </div>
            )}
        </li>
    );
};

const BackupContainer = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const limit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);
    const { page, setPage } = useContext(ServerBackupContext);
    const { data, error, mutate } = getServerBackups();
    const [canCreate] = usePermissions(['backup.create']);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState<ServerBackup | null>(null);
    const [deleting, setDeleting] = useState<ServerBackup | null>(null);
    const [unlocking, setUnlocking] = useState<ServerBackup | null>(null);
    const [busy, setBusy] = useState(false);

    const toggleLock = async (backup: ServerBackup) => {
        setBusy(true);
        try {
            await http.post(`/api/client/servers/${uuid}/backups/${backup.uuid}/lock`);
            await mutate(
                (current) =>
                    current && {
                        ...current,
                        items: current.items.map((b) => (b.uuid === backup.uuid ? { ...b, isLocked: !b.isLocked } : b)),
                    },
                false
            );
            toast.success(backup.isLocked ? t('Backup unlocked') : t('Backup locked'), backup.name);
            setUnlocking(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            await deleteBackup(uuid, deleting.uuid);
            await mutate(
                (current) =>
                    current && {
                        ...current,
                        items: current.items.filter((b) => b.uuid !== deleting.uuid),
                        backupCount: current.backupCount - 1,
                    },
                false
            );
            toast.success(t('Backup deleted'), deleting.name);
            setDeleting(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const count = data?.backupCount ?? 0;
    const full = count >= limit;

    return (
        <ServerContentBlock
            title={t('Backups')}
            icon={ArchiveIcon}
            description={t(
                'Snapshots of the server files. Make one before updates or big changes, restore it in a click.'
            )}
            actions={
                canCreate && limit > 0 ? (
                    <Button icon={PlusIcon} disabled={!data || full} onClick={() => setCreating(true)}>
                        {t('Create backup')}
                    </Button>
                ) : undefined
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{httpErrorToHuman(error)}</Callout>
                </div>
            )}

            {limit > 0 && data && (
                <div className={'mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400'}>
                    <span className={'whitespace-nowrap'}>{t('{{count}} of {{limit}} backups', { count, limit })}</span>
                    <Meter value={count} max={limit} className={'flex-1 max-w-xs'} />
                    {full && <span className={'text-amber-300'}>{t('Delete an old backup to create a new one.')}</span>}
                </div>
            )}

            {!data ? (
                <Skeleton className={'h-48 rounded-xl'} />
            ) : !data.items.length ? (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={ArchiveIcon}
                        title={limit > 0 ? t('No backups yet') : t('Backups are not available')}
                        description={
                            limit > 0
                                ? t('Create the first backup now, so you can go back if something breaks.')
                                : t('Your hosting provider has not enabled backups for this server.')
                        }
                        action={
                            canCreate && limit > 0 ? (
                                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                                    {t('Create backup')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            ) : (
                <>
                    <ul className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 divide-y divide-gray-800'}>
                        {data.items.map((backup) => (
                            <BackupCard
                                key={backup.uuid}
                                backup={backup}
                                onRestore={() => setRestoring(backup)}
                                onDelete={() => setDeleting(backup)}
                                onToggleLock={() => (backup.isLocked ? setUnlocking(backup) : toggleLock(backup))}
                            />
                        ))}
                    </ul>
                    <Pager page={page} total={data.pagination.totalPages} onChange={setPage} />
                </>
            )}

            <CreateBackupModal open={creating} onClose={() => setCreating(false)} />
            <RestoreModal backup={restoring} onClose={() => setRestoring(null)} />
            <Confirm
                open={!!deleting}
                title={t('Delete {{name}}?', { name: deleting?.name })}
                confirm={t('Delete backup')}
                loading={busy}
                onConfirm={remove}
                onClose={() => setDeleting(null)}
            >
                {t('The backup is deleted permanently and cannot be restored anymore.')}
            </Confirm>
            <Confirm
                open={!!unlocking}
                danger={false}
                title={t('Unlock {{name}}?', { name: unlocking?.name })}
                confirm={t('Unlock')}
                loading={busy}
                onConfirm={() => unlocking && toggleLock(unlocking)}
                onClose={() => setUnlocking(null)}
            >
                {t('The backup is no longer protected from deletion and can be rotated out automatically.')}
            </Confirm>
        </ServerContentBlock>
    );
};

export default () => {
    const [page, setPage] = useState<number>(1);

    return (
        <ServerBackupContext.Provider value={{ page, setPage }}>
            <BackupContainer />
        </ServerBackupContext.Provider>
    );
};
