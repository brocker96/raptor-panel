import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import {
    ChevronDownIcon,
    CollectionIcon,
    DatabaseIcon,
    PlusIcon,
    RefreshIcon,
    TableIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerDatabases, { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import createServerDatabase from '@/api/server/databases/createServerDatabase';
import deleteServerDatabase from '@/api/server/databases/deleteServerDatabase';
import rotateDatabasePassword from '@/api/server/databases/rotateDatabasePassword';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Modal from '@/components/ui/Modal';
import CopyField from '@/components/ui/CopyField';
import Button from '@/components/admin/ui/Button';
import { Callout, EmptyState, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { TextInput } from '@/components/admin/ui/Form';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { usePermissions } from '@/plugins/usePermissions';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const NAME = /^[\w\-.]{3,48}$/;
const REMOTE = /^[\w\-/.%:]+$/;

const CreateDatabaseModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const internalId = ServerContext.useStoreState((state) => state.server.data!.internalId);
    const appendDatabase = ServerContext.useStoreActions((actions) => actions.databases.appendDatabase);
    const [name, setName] = useState('');
    const [remote, setRemote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setName('');
        setRemote('');
        setError('');
    }, [open]);

    const nameError =
        name && !NAME.test(name) ? t('Use 3 to 48 letters, numbers, dashes, dots or underscores.') : undefined;
    const remoteError = remote && !REMOTE.test(remote) ? t('A valid host address must be provided.') : undefined;

    const submit = async () => {
        if (!NAME.test(name) || remoteError) return;
        setBusy(true);
        setError('');
        try {
            const database = await createServerDatabase(uuid, { databaseName: name, connectionsFrom: remote || '%' });
            appendDatabase(database);
            toast.success(t('Database created'), database.name);
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
            icon={DatabaseIcon}
            title={t('Create a database')}
            description={t('A MySQL database with its own user and a generated password.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        icon={PlusIcon}
                        loading={busy}
                        disabled={!NAME.test(name) || !!remoteError}
                        onClick={submit}
                    >
                        {t('Create database')}
                    </Button>
                </>
            }
        >
            <form
                className={'space-y-4'}
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                {error && <Callout tone={'red'}>{error}</Callout>}
                <TextInput
                    label={t('Name')}
                    value={name}
                    onChange={setName}
                    error={nameError}
                    placeholder={'luckperms'}
                    autoFocus
                    description={
                        <>
                            {t('It is created as')}{' '}
                            <span className={'font-mono text-gray-300'}>
                                s{internalId}_{name || 'name'}
                            </span>
                        </>
                    }
                />
                <TextInput
                    label={t('Allow connections from')}
                    value={remote}
                    onChange={setRemote}
                    error={remoteError}
                    placeholder={'%'}
                    description={t(
                        'An IP address or host the database accepts connections from. Leave it empty to allow connections from anywhere.'
                    )}
                />
                <button type={'submit'} className={'hidden'} />
            </form>
        </Modal>
    );
};

const DatabaseCard = ({
    database,
    onRotate,
    onDelete,
}: {
    database: ServerDatabase;
    onRotate: () => void;
    onDelete: () => void;
}) => {
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const [canManage, canUpdate, canDelete, canViewPassword] = usePermissions([
        'database.manage',
        'database.update',
        'database.delete',
        'database.view_password',
    ]);
    const [expanded, setExpanded] = useState(false);
    const [host, port] = database.connectionString.split(/:(?=\d+$)/);
    const password = canViewPassword && database.password ? database.password : '';
    const auth = `${encodeURIComponent(database.username)}${password ? ':' + encodeURIComponent(password) : ''}`;

    const strings = [
        {
            label: 'JDBC',
            value: `jdbc:mysql://${host}:${port}/${database.name}?user=${encodeURIComponent(database.username)}${
                password ? `&password=${encodeURIComponent(password)}` : ''
            }`,
        },
        { label: 'URI', value: `mysql://${auth}@${host}:${port}/${database.name}` },
        {
            label: '.env',
            value: `DB_HOST=${host}\nDB_PORT=${port}\nDB_DATABASE=${database.name}\nDB_USERNAME=${database.username}${
                password ? `\nDB_PASSWORD=${password}` : ''
            }`,
        },
    ];

    return (
        <li className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
            <div className={'flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4'}>
                <button
                    type={'button'}
                    onClick={() => setExpanded((v) => !v)}
                    className={'flex items-center gap-3 min-w-0 flex-1 text-left'}
                    aria-expanded={expanded}
                >
                    <span
                        className={
                            'grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20'
                        }
                    >
                        <DatabaseIcon className={'w-5 h-5'} />
                    </span>
                    <span className={'min-w-0'}>
                        <span className={'block font-mono text-sm text-gray-50 break-all'}>{database.name}</span>
                        <span className={'flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-gray-500'}>
                            <span className={'font-mono'}>{database.connectionString}</span>
                            <span>·</span>
                            <span>
                                {database.allowConnectionsFrom === '%'
                                    ? t('connections from anywhere')
                                    : t('connections from {{remote}}', { remote: database.allowConnectionsFrom })}
                            </span>
                        </span>
                    </span>
                    <ChevronDownIcon
                        className={classNames(
                            'hidden sm:block ml-auto w-4 h-4 text-gray-500 transition-transform',
                            expanded && 'rotate-180'
                        )}
                    />
                </button>
                <div className={'flex flex-wrap items-center gap-1.5'}>
                    {canManage && (
                        <Button
                            size={'sm'}
                            icon={TableIcon}
                            to={`/server/${serverId}/databases/${database.id}/manager`}
                            className={'flex-1 sm:flex-none'}
                        >
                            {t('Open DB Manager')}
                        </Button>
                    )}
                    <Button
                        variant={'secondary'}
                        size={'sm'}
                        onClick={() => setExpanded((v) => !v)}
                        className={'flex-1 sm:flex-none'}
                    >
                        {expanded ? t('Hide details') : t('Connect')}
                    </Button>
                    {canDelete && (
                        <Button
                            variant={'ghost'}
                            size={'sm'}
                            icon={TrashIcon}
                            aria-label={t('Delete')}
                            title={t('Delete')}
                            onClick={onDelete}
                        />
                    )}
                </div>
            </div>
            {expanded && (
                <div className={'border-t border-gray-800 px-4 sm:px-5 py-4 space-y-4'}>
                    <div className={'grid sm:grid-cols-2 lg:grid-cols-4 gap-3'}>
                        <CopyField label={t('Host')} value={host} />
                        <CopyField label={t('Port')} value={port || '3306'} />
                        <CopyField label={t('Username')} value={database.username} />
                        {canViewPassword && database.password ? (
                            <CopyField label={t('Password')} value={database.password} secret />
                        ) : (
                            <div>
                                <p className={'mb-1 text-xs text-gray-500'}>{t('Password')}</p>
                                <p className={'text-xs text-gray-500 py-2'}>
                                    {t('You are not allowed to see the password.')}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className={'grid lg:grid-cols-3 gap-3'}>
                        {strings.map((item) => (
                            <CopyField key={item.label} label={item.label} value={item.value} secret={!!password} />
                        ))}
                    </div>
                    {canUpdate && (
                        <div className={'flex flex-wrap items-center gap-3 pt-1'}>
                            <p className={'flex-1 min-w-[12rem] text-xs text-gray-500'}>
                                {t('A new password logs out every plugin or app connected with the old one.')}
                            </p>
                            <Button variant={'secondary'} size={'sm'} icon={RefreshIcon} onClick={onRotate}>
                                {t('Rotate password')}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const limit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.databases);
    const databases = ServerContext.useStoreState((state) => state.databases.data);
    const setDatabases = ServerContext.useStoreActions((actions) => actions.databases.setDatabases);
    const appendDatabase = ServerContext.useStoreActions((actions) => actions.databases.appendDatabase);
    const removeDatabase = ServerContext.useStoreActions((actions) => actions.databases.removeDatabase);
    const [canCreate] = usePermissions(['database.create']);

    const [loading, setLoading] = useState(!databases.length);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [rotating, setRotating] = useState<ServerDatabase | null>(null);
    const [deleting, setDeleting] = useState<ServerDatabase | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getServerDatabases(uuid)
            .then(setDatabases)
            .catch((err) => setError(httpErrorToHuman(err)))
            .then(() => setLoading(false));
    }, []);

    const rotate = async () => {
        if (!rotating) return;
        setBusy(true);
        try {
            appendDatabase(await rotateDatabasePassword(uuid, rotating.id));
            toast.success(t('Password rotated'), rotating.name);
            setRotating(null);
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
            await deleteServerDatabase(uuid, deleting.id);
            removeDatabase(deleting.id);
            toast.success(t('Database deleted'), deleting.name);
            setDeleting(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const full = databases.length >= limit;

    return (
        <ServerContentBlock
            title={t('Databases')}
            icon={CollectionIcon}
            description={t('MySQL databases for plugins and mods, with the Raptor DB Manager to look inside them.')}
            actions={
                canCreate && limit > 0 ? (
                    <Button
                        icon={PlusIcon}
                        disabled={full}
                        onClick={() => setCreating(true)}
                        title={full ? t('The limit of databases has been reached.') : undefined}
                    >
                        {t('New database')}
                    </Button>
                ) : undefined
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{error}</Callout>
                </div>
            )}

            {limit > 0 && databases.length > 0 && (
                <div className={'mb-4 flex items-center gap-3 text-xs text-gray-400'}>
                    <span className={'whitespace-nowrap'}>
                        {t('{{count}} of {{limit}} databases used', { count: databases.length, limit })}
                    </span>
                    <Meter value={databases.length} max={limit} className={'flex-1 max-w-xs'} />
                </div>
            )}

            {loading ? (
                <div className={'space-y-3'}>
                    <Skeleton className={'h-20 rounded-xl'} />
                    <Skeleton className={'h-20 rounded-xl'} />
                </div>
            ) : databases.length ? (
                <ul className={'space-y-3'}>
                    {databases.map((database) => (
                        <DatabaseCard
                            key={database.id}
                            database={database}
                            onRotate={() => setRotating(database)}
                            onDelete={() => setDeleting(database)}
                        />
                    ))}
                </ul>
            ) : (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={DatabaseIcon}
                        title={limit > 0 ? t('No databases yet') : t('Databases are not available')}
                        description={
                            limit > 0
                                ? t(
                                      'Many plugins such as LuckPerms or CoreProtect store their data in MySQL. Create a database and paste its details into the plugin config.'
                                  )
                                : t('Your hosting provider has not enabled databases for this server.')
                        }
                        action={
                            canCreate && limit > 0 ? (
                                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                                    {t('New database')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            )}

            <CreateDatabaseModal open={creating} onClose={() => setCreating(false)} />
            <Confirm
                open={!!rotating}
                danger={false}
                title={t('Rotate the password of {{name}}?', { name: rotating?.name })}
                confirm={t('Rotate password')}
                loading={busy}
                onConfirm={rotate}
                onClose={() => setRotating(null)}
            >
                {t('A new random password is generated. Update it in every plugin or app that uses this database.')}
            </Confirm>
            <Confirm
                open={!!deleting}
                title={t('Delete {{name}}?', { name: deleting?.name })}
                confirm={t('Delete database')}
                challenge={deleting?.name}
                loading={busy}
                onConfirm={remove}
                onClose={() => setDeleting(null)}
            >
                {t(
                    'The database, its user and all of its data are deleted permanently. Export it in the DB Manager first if you might need it.'
                )}
            </Confirm>
        </ServerContentBlock>
    );
};
