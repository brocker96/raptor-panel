import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowCircleUpIcon,
    CheckCircleIcon,
    ClockIcon,
    CloudDownloadIcon,
    ExclamationIcon,
    ExternalLinkIcon,
    RefreshIcon,
    ReplyIcon,
    TerminalIcon,
} from '@heroicons/react/outline';
import { queryClient, useResource } from '@/api/query';
import {
    cancelUpdate,
    getUpdates,
    getUpdateStatus,
    installUpdate,
    Release,
    rollbackUpdate,
    UpdateBackup,
    UpdateState,
    updateUpdateChannel,
} from '@/api/admin';
import { Page, Segmented } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { ago, formatBytes, useAction } from '@/components/admin/ui/hooks';
import { t } from '@/i18n';

const active = (state?: UpdateState) => state?.status === 'queued' || state?.status === 'running';

const ReleaseNotes = ({ notes }: { notes: string }) => (
    <div className={'max-h-72 overflow-y-auto rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 p-4'}>
        <pre className={'text-xs text-gray-300 whitespace-pre-wrap break-words font-sans leading-relaxed'}>
            {notes.trim() || 'This release has no release notes.'}
        </pre>
    </div>
);

interface ProgressProps {
    onFinished: () => void;
    onCancel: () => void;
    cancelling: boolean;
}

const Progress = ({ onFinished, onCancel, cancelling }: ProgressProps) => {
    const { data } = useResource(['admin', 'updates', 'status'], getUpdateStatus, { refetchInterval: 2000 });
    const log = useRef<HTMLPreElement>(null);
    const startVersion = useRef<string | null>(null);
    const state = data?.state;

    useEffect(() => {
        if (data && startVersion.current === null) startVersion.current = data.version;
        if (log.current) log.current.scrollTop = log.current.scrollHeight;
    }, [data]);

    useEffect(() => {
        if (state && !active(state)) onFinished();
    }, [state?.status]);

    const waiting = state?.status === 'queued' && state.requested_at;
    const stuck = waiting && Date.now() - new Date(state!.requested_at!).getTime() > 90_000;

    return (
        <div className={'space-y-4'}>
            <div className={'flex items-center gap-3'}>
                <span className={'relative flex w-3 h-3'}>
                    <span className={'absolute inset-0 rounded-full bg-raptor-400 animate-ping opacity-60'} />
                    <span className={'relative w-3 h-3 rounded-full bg-raptor-400'} />
                </span>
                <p className={'flex-1 text-sm font-medium text-gray-100 min-w-0 break-words'}>
                    {state?.step || t('Connecting…')}
                </p>
                {state?.status === 'queued' && (
                    <Button size={'sm'} variant={'secondary'} loading={cancelling} onClick={onCancel}>
                        {t('Cancel')}
                    </Button>
                )}
            </div>
            {stuck && (
                <Callout tone={'yellow'} icon={ClockIcon} title={t('The scheduler has not picked up the update yet')}>
                    {t(
                        'Updates are run by the scheduler, which runs every minute. Check that the cron job of the Panel exists ('
                    )}
                    <code>crontab -u www-data -l</code>
                    {t(') or run the update in a terminal with')} <code>php artisan raptor:update --pending</code>.
                </Callout>
            )}
            <pre
                ref={log}
                className={
                    'h-72 overflow-auto rounded-lg bg-gray-950 ring-1 ring-inset ring-gray-800 p-3 text-[11px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap break-all'
                }
            >
                {data?.log || 'Waiting for output…'}
            </pre>
        </div>
    );
};

const ResultCallout = ({ state }: { state: UpdateState }) => {
    if (!state.finished_at || (state.status !== 'completed' && state.status !== 'failed')) return null;

    return state.status === 'completed' ? (
        <Callout tone={'green'} icon={CheckCircleIcon} title={state.step}>
            {t('Finished {{ago}}', { ago: ago(state.finished_at) })}
            {state.requested_by ? t(' · started by {{requested_by}}', { requested_by: state.requested_by }) : ''}.{' '}
            <button type={'button'} className={'font-medium underline'} onClick={() => window.location.reload()}>
                {t('Reload the page')}
            </button>{' '}
            {t('to load the new interface.')}
        </Callout>
    ) : (
        <Callout tone={'red'} icon={ExclamationIcon} title={state.step}>
            <span className={'break-words'}>{state.error}</span>
            <span className={'block mt-1 text-xs opacity-80'}>
                {t('Finished {{ago}}. The full output is in', { ago: ago(state.finished_at) })}{' '}
                <code>storage/app/raptor/updates/update.log</code>.
            </span>
        </Callout>
    );
};

export default () => {
    const [refresh, setRefresh] = useState(false);
    const { data, isValidating, mutate } = useResource(['admin', 'updates', refresh], (signal) =>
        getUpdates(refresh, signal)
    );
    const [install, setInstall] = useState<Release | null>(null);
    const [rollback, setRollback] = useState<UpdateBackup | null>(null);
    const [following, setFollowing] = useState(false);

    useEffect(() => {
        if (active(data?.state)) setFollowing(true);
    }, [data?.state.status]);

    const onStarted = () => {
        setInstall(null);
        setRollback(null);
        setFollowing(true);
        queryClient.removeQueries({ queryKey: ['admin', 'updates', 'status'] });
    };

    const start = useAction(installUpdate, { success: t('Update queued'), onSuccess: onStarted });
    const restore = useAction(rollbackUpdate, { success: t('Rollback queued'), onSuccess: onStarted });
    const cancel = useAction(cancelUpdate, {
        success: t('Update cancelled'),
        onSuccess: () => {
            setFollowing(false);
            mutate();
        },
    });
    const channel = useAction((value: 'stable' | 'beta', autoCheck: boolean) => updateUpdateChannel(value, autoCheck), {
        success: t('Update settings saved'),
        onSuccess: (result) => mutate(result, false),
    });

    const latest = data?.latest;

    return (
        <Page
            title={t('Updates')}
            icon={ArrowCircleUpIcon}
            description={t('Install new Raptor Panel releases with one click, with an automatic backup and rollback.')}
            guide={'updates'}
            actions={
                <Button
                    variant={'secondary'}
                    icon={RefreshIcon}
                    loading={isValidating && refresh}
                    disabled={!data}
                    onClick={() => (refresh ? mutate() : setRefresh(true))}
                >
                    {t('Check for updates')}
                </Button>
            }
        >
            {!data ? (
                <Skeleton className={'h-64 rounded-xl'} />
            ) : (
                <>
                    {data.error && (
                        <Callout tone={'yellow'} icon={ExclamationIcon} title={t('Could not check for updates')}>
                            <span className={'break-words'}>{data.error}</span>
                        </Callout>
                    )}
                    <div className={'grid gap-6 lg:grid-cols-3'}>
                        <Card
                            className={'lg:col-span-2'}
                            title={
                                following
                                    ? data.state.action === 'rollback'
                                        ? t('Rolling back')
                                        : t('Updating')
                                    : data.update_available
                                    ? t('Update available')
                                    : t('Raptor Panel is up to date')
                            }
                            icon={
                                following
                                    ? CloudDownloadIcon
                                    : data.update_available
                                    ? ArrowCircleUpIcon
                                    : CheckCircleIcon
                            }
                        >
                            {following ? (
                                <Progress
                                    cancelling={cancel.loading}
                                    onCancel={() => cancel.run()}
                                    onFinished={() => {
                                        setFollowing(false);
                                        mutate();
                                    }}
                                />
                            ) : (
                                <div className={'space-y-5'}>
                                    <ResultCallout state={data.state} />
                                    <div className={'flex flex-wrap items-center gap-x-8 gap-y-3'}>
                                        <div className={'min-w-0'}>
                                            <p className={'text-xs uppercase tracking-wider text-gray-500'}>
                                                {t('Installed')}
                                            </p>
                                            <p className={'mt-1 text-xl font-semibold text-gray-50 break-all'}>
                                                {data.current}
                                            </p>
                                        </div>
                                        <div className={'min-w-0'}>
                                            <p className={'text-xs uppercase tracking-wider text-gray-500'}>
                                                {t('Latest on {{channel}}', { channel: data.channel })}
                                            </p>
                                            <p className={'mt-1 text-xl font-semibold text-gray-50 break-all'}>
                                                {latest ? latest.version : '—'}
                                                {latest?.prerelease && (
                                                    <Badge tone={'yellow'} className={'ml-2 align-middle'}>
                                                        {t('pre-release')}
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {data.development && (
                                        <Callout tone={'blue'} title={t('Development build')}>
                                            {t(
                                                'This Panel was installed from a git branch, so its exact version is unknown. Installing a release switches it to tagged versions that can be updated with one click from now on.'
                                            )}
                                        </Callout>
                                    )}
                                    {!latest && !data.error && (
                                        <p className={'text-sm text-gray-400'}>
                                            {t('No release was published on the {{channel}} channel of', {
                                                channel: data.channel,
                                            })}{' '}
                                            <code>{data.repository}</code> {t('yet.')}
                                        </p>
                                    )}
                                    {latest && data.update_available && (
                                        <>
                                            <ReleaseNotes notes={latest.notes} />
                                            <div className={'flex flex-wrap items-center gap-3'}>
                                                <Button
                                                    icon={CloudDownloadIcon}
                                                    disabled={!latest.archive}
                                                    onClick={() => setInstall(latest)}
                                                >
                                                    {t('Update to {{version}}', { version: latest.version })}
                                                </Button>
                                                {latest.url && (
                                                    <a
                                                        href={latest.url}
                                                        target={'_blank'}
                                                        rel={'noreferrer'}
                                                        className={
                                                            'inline-flex items-center gap-1 text-xs text-raptor-300 hover:text-raptor-200'
                                                        }
                                                    >
                                                        {t('Release on GitHub')}{' '}
                                                        <ExternalLinkIcon className={'w-3.5 h-3.5'} />
                                                    </a>
                                                )}
                                                {!latest.archive && (
                                                    <span className={'text-xs text-amber-300'}>
                                                        {t('This release has no panel.tar.gz asset yet.')}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                        <Card title={t('Settings')} description={t('Which releases are offered.')}>
                            <div className={'space-y-4'}>
                                <div>
                                    <p className={'text-xs font-medium text-gray-300 mb-2'}>{t('Update channel')}</p>
                                    <Segmented
                                        id={'update-channel'}
                                        value={data.channel}
                                        onChange={(value) => channel.run(value, data.auto_check)}
                                        options={[
                                            { value: 'stable', label: t('Stable') },
                                            { value: 'beta', label: t('Beta') },
                                        ]}
                                    />
                                    <p className={'mt-2 text-xs text-gray-500 leading-relaxed'}>
                                        {data.channel === 'beta'
                                            ? t('Pre-releases are offered as well, they get new features first.')
                                            : t('Only final releases are offered.')}
                                    </p>
                                </div>
                                <Toggle
                                    label={t('Check automatically')}
                                    description={t(
                                        'Look for new releases every hour and show a notice in the admin area.'
                                    )}
                                    checked={data.auto_check}
                                    onChange={(value) => channel.run(data.channel, value)}
                                />
                                <p className={'text-xs text-gray-500 break-words'}>
                                    {t('Source:')} <code>github.com/{data.repository}</code>
                                </p>
                            </div>
                        </Card>
                    </div>
                    <div className={'grid gap-6 lg:grid-cols-2'}>
                        <Card
                            title={t('Backups')}
                            icon={ReplyIcon}
                            description={t('Made before every update: Panel files, .env and the database.')}
                            flush
                        >
                            {data.backups.length === 0 ? (
                                <EmptyState
                                    icon={ReplyIcon}
                                    title={t('No backups yet')}
                                    description={t('A backup is created automatically the first time you update.')}
                                />
                            ) : (
                                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                                    {data.backups.map((backup) => (
                                        <li key={backup.id} className={'flex items-center gap-3 px-5 py-3'}>
                                            <div className={'flex-1 min-w-0'}>
                                                <p className={'text-sm text-gray-100'}>
                                                    {t('Version')}{' '}
                                                    <span className={'font-medium'}>{backup.version}</span>
                                                </p>
                                                <p className={'text-xs text-gray-500'}>
                                                    {ago(backup.created_at)} · {formatBytes(backup.size)}
                                                    {!backup.database && t(' · without database')}
                                                </p>
                                            </div>
                                            <Button
                                                size={'sm'}
                                                variant={'secondary'}
                                                icon={ReplyIcon}
                                                disabled={following}
                                                onClick={() => setRollback(backup)}
                                            >
                                                {t('Roll back')}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <Card
                            title={t('Releases')}
                            description={t('Recent releases of {{repository}}.', { repository: data.repository })}
                            flush
                        >
                            {data.releases.length === 0 ? (
                                <EmptyState
                                    icon={CloudDownloadIcon}
                                    title={t('No releases found')}
                                    description={t('Published releases show up here.')}
                                />
                            ) : (
                                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                                    {data.releases.map((release) => (
                                        <li key={release.tag} className={'flex items-center gap-3 px-5 py-3'}>
                                            <div className={'flex-1 min-w-0'}>
                                                <p
                                                    className={
                                                        'flex flex-wrap items-center gap-2 text-sm text-gray-100'
                                                    }
                                                >
                                                    <span className={'font-medium break-all'}>{release.name}</span>
                                                    {release.prerelease && (
                                                        <Badge tone={'yellow'}>{t('pre-release')}</Badge>
                                                    )}
                                                    {release.version === data.current && (
                                                        <Badge tone={'green'}>{t('installed')}</Badge>
                                                    )}
                                                </p>
                                                <p className={'text-xs text-gray-500'}>
                                                    {release.published_at
                                                        ? ago(release.published_at)
                                                        : t('unpublished')}
                                                </p>
                                            </div>
                                            {release.url && (
                                                <a
                                                    href={release.url}
                                                    target={'_blank'}
                                                    rel={'noreferrer'}
                                                    className={'p-2 text-gray-500 hover:text-gray-200'}
                                                    aria-label={t('Open on GitHub')}
                                                >
                                                    <ExternalLinkIcon className={'w-4 h-4'} />
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                    <Card
                        title={t('Command line')}
                        icon={TerminalIcon}
                        description={t('Everything also works over SSH.')}
                    >
                        <pre
                            className={
                                'overflow-x-auto rounded-lg bg-gray-950 ring-1 ring-inset ring-gray-800 p-3 text-xs text-gray-300 font-mono'
                            }
                        >
                            {[
                                `cd ${data.base_path}`,
                                'sudo -u www-data php artisan raptor:update --check      # look for a new release',
                                'sudo -u www-data php artisan raptor:update              # update to the newest release',
                                'sudo -u www-data php artisan raptor:update --backups    # list backups',
                                'sudo -u www-data php artisan raptor:update --rollback=latest',
                            ].join('\n')}
                        </pre>
                    </Card>
                </>
            )}
            <Confirm
                open={!!install}
                danger={false}
                title={t('Update to {{version}}?', { version: install?.version })}
                confirm={t('Start update')}
                loading={start.loading}
                onConfirm={() => install && start.run(install.version)}
                onClose={() => setInstall(null)}
            >
                {t(
                    'The Panel makes a backup of its files and database, goes into maintenance mode for a minute or two and installs the release. If anything fails the backup is restored automatically. Game servers keep running during the update.'
                )}
            </Confirm>
            <Confirm
                open={!!rollback}
                title={t('Roll back to this backup?')}
                confirm={t('Roll back')}
                challenge={rollback?.version}
                loading={restore.loading}
                onConfirm={() => rollback && restore.run(rollback.id)}
                onClose={() => setRollback(null)}
            >
                {t(
                    'The Panel files and the database are replaced by the state of {{ago}}. Everything changed in the Panel since then (new users, servers, settings) is lost. Files of game servers on your nodes are not affected.',
                    { ago: ago(rollback?.created_at) }
                )}
            </Confirm>
        </Page>
    );
};
