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
                    {state?.step || 'Connecting…'}
                </p>
                {state?.status === 'queued' && (
                    <Button size={'sm'} variant={'secondary'} loading={cancelling} onClick={onCancel}>
                        Cancel
                    </Button>
                )}
            </div>
            {stuck && (
                <Callout tone={'yellow'} icon={ClockIcon} title={'The scheduler has not picked up the update yet'}>
                    Updates are run by the scheduler, which runs every minute. Check that the cron job of the Panel
                    exists (<code>crontab -u www-data -l</code>) or run the update in a terminal with{' '}
                    <code>php artisan raptor:update --pending</code>.
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
            Finished {ago(state.finished_at)}
            {state.requested_by ? ` · started by ${state.requested_by}` : ''}.{' '}
            <button type={'button'} className={'font-medium underline'} onClick={() => window.location.reload()}>
                Reload the page
            </button>{' '}
            to load the new interface.
        </Callout>
    ) : (
        <Callout tone={'red'} icon={ExclamationIcon} title={state.step}>
            <span className={'break-words'}>{state.error}</span>
            <span className={'block mt-1 text-xs opacity-80'}>
                Finished {ago(state.finished_at)}. The full output is in{' '}
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

    const start = useAction(installUpdate, { success: 'Update queued', onSuccess: onStarted });
    const restore = useAction(rollbackUpdate, { success: 'Rollback queued', onSuccess: onStarted });
    const cancel = useAction(cancelUpdate, {
        success: 'Update cancelled',
        onSuccess: () => {
            setFollowing(false);
            mutate();
        },
    });
    const channel = useAction((value: 'stable' | 'beta', autoCheck: boolean) => updateUpdateChannel(value, autoCheck), {
        success: 'Update settings saved',
        onSuccess: (result) => mutate(result, false),
    });

    const latest = data?.latest;

    return (
        <Page
            title={'Updates'}
            icon={ArrowCircleUpIcon}
            description={'Install new Raptor Panel releases with one click, with an automatic backup and rollback.'}
            guide={'updates'}
            actions={
                <Button
                    variant={'secondary'}
                    icon={RefreshIcon}
                    loading={isValidating && refresh}
                    disabled={!data}
                    onClick={() => (refresh ? mutate() : setRefresh(true))}
                >
                    Check for updates
                </Button>
            }
        >
            {!data ? (
                <Skeleton className={'h-64 rounded-xl'} />
            ) : (
                <>
                    {data.error && (
                        <Callout tone={'yellow'} icon={ExclamationIcon} title={'Could not check for updates'}>
                            <span className={'break-words'}>{data.error}</span>
                        </Callout>
                    )}
                    <div className={'grid gap-6 lg:grid-cols-3'}>
                        <Card
                            className={'lg:col-span-2'}
                            title={
                                following
                                    ? data.state.action === 'rollback'
                                        ? 'Rolling back'
                                        : 'Updating'
                                    : data.update_available
                                    ? 'Update available'
                                    : 'Raptor Panel is up to date'
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
                                                Installed
                                            </p>
                                            <p className={'mt-1 text-xl font-semibold text-gray-50 break-all'}>
                                                {data.current}
                                            </p>
                                        </div>
                                        <div className={'min-w-0'}>
                                            <p className={'text-xs uppercase tracking-wider text-gray-500'}>
                                                Latest on {data.channel}
                                            </p>
                                            <p className={'mt-1 text-xl font-semibold text-gray-50 break-all'}>
                                                {latest ? latest.version : '—'}
                                                {latest?.prerelease && (
                                                    <Badge tone={'yellow'} className={'ml-2 align-middle'}>
                                                        pre-release
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {data.development && (
                                        <Callout tone={'blue'} title={'Development build'}>
                                            This Panel was installed from a git branch, so its exact version is unknown.
                                            Installing a release switches it to tagged versions that can be updated with
                                            one click from now on.
                                        </Callout>
                                    )}
                                    {!latest && !data.error && (
                                        <p className={'text-sm text-gray-400'}>
                                            No release was published on the {data.channel} channel of{' '}
                                            <code>{data.repository}</code> yet.
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
                                                    Update to {latest.version}
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
                                                        Release on GitHub <ExternalLinkIcon className={'w-3.5 h-3.5'} />
                                                    </a>
                                                )}
                                                {!latest.archive && (
                                                    <span className={'text-xs text-amber-300'}>
                                                        This release has no panel.tar.gz asset yet.
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                        <Card title={'Settings'} description={'Which releases are offered.'}>
                            <div className={'space-y-4'}>
                                <div>
                                    <p className={'text-xs font-medium text-gray-300 mb-2'}>Update channel</p>
                                    <Segmented
                                        id={'update-channel'}
                                        value={data.channel}
                                        onChange={(value) => channel.run(value, data.auto_check)}
                                        options={[
                                            { value: 'stable', label: 'Stable' },
                                            { value: 'beta', label: 'Beta' },
                                        ]}
                                    />
                                    <p className={'mt-2 text-xs text-gray-500 leading-relaxed'}>
                                        {data.channel === 'beta'
                                            ? 'Pre-releases are offered as well, they get new features first.'
                                            : 'Only final releases are offered.'}
                                    </p>
                                </div>
                                <Toggle
                                    label={'Check automatically'}
                                    description={
                                        'Look for new releases every hour and show a notice in the admin area.'
                                    }
                                    checked={data.auto_check}
                                    onChange={(value) => channel.run(data.channel, value)}
                                />
                                <p className={'text-xs text-gray-500 break-words'}>
                                    Source: <code>github.com/{data.repository}</code>
                                </p>
                            </div>
                        </Card>
                    </div>
                    <div className={'grid gap-6 lg:grid-cols-2'}>
                        <Card
                            title={'Backups'}
                            icon={ReplyIcon}
                            description={'Made before every update: Panel files, .env and the database.'}
                            flush
                        >
                            {data.backups.length === 0 ? (
                                <EmptyState
                                    icon={ReplyIcon}
                                    title={'No backups yet'}
                                    description={'A backup is created automatically the first time you update.'}
                                />
                            ) : (
                                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                                    {data.backups.map((backup) => (
                                        <li key={backup.id} className={'flex items-center gap-3 px-5 py-3'}>
                                            <div className={'flex-1 min-w-0'}>
                                                <p className={'text-sm text-gray-100'}>
                                                    Version <span className={'font-medium'}>{backup.version}</span>
                                                </p>
                                                <p className={'text-xs text-gray-500'}>
                                                    {ago(backup.created_at)} · {formatBytes(backup.size)}
                                                    {!backup.database && ' · without database'}
                                                </p>
                                            </div>
                                            <Button
                                                size={'sm'}
                                                variant={'secondary'}
                                                icon={ReplyIcon}
                                                disabled={following}
                                                onClick={() => setRollback(backup)}
                                            >
                                                Roll back
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <Card title={'Releases'} description={`Recent releases of ${data.repository}.`} flush>
                            {data.releases.length === 0 ? (
                                <EmptyState
                                    icon={CloudDownloadIcon}
                                    title={'No releases found'}
                                    description={'Published releases show up here.'}
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
                                                    {release.prerelease && <Badge tone={'yellow'}>pre-release</Badge>}
                                                    {release.version === data.current && (
                                                        <Badge tone={'green'}>installed</Badge>
                                                    )}
                                                </p>
                                                <p className={'text-xs text-gray-500'}>
                                                    {release.published_at ? ago(release.published_at) : 'unpublished'}
                                                </p>
                                            </div>
                                            {release.url && (
                                                <a
                                                    href={release.url}
                                                    target={'_blank'}
                                                    rel={'noreferrer'}
                                                    className={'p-2 text-gray-500 hover:text-gray-200'}
                                                    aria-label={'Open on GitHub'}
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
                    <Card title={'Command line'} icon={TerminalIcon} description={'Everything also works over SSH.'}>
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
                title={`Update to ${install?.version}?`}
                confirm={'Start update'}
                loading={start.loading}
                onConfirm={() => install && start.run(install.version)}
                onClose={() => setInstall(null)}
            >
                The Panel makes a backup of its files and database, goes into maintenance mode for a minute or two and
                installs the release. If anything fails the backup is restored automatically. Game servers keep running
                during the update.
            </Confirm>
            <Confirm
                open={!!rollback}
                title={'Roll back to this backup?'}
                confirm={'Roll back'}
                challenge={rollback?.version}
                loading={restore.loading}
                onConfirm={() => rollback && restore.run(rollback.id)}
                onClose={() => setRollback(null)}
            >
                The Panel files and the database are replaced by the state of {ago(rollback?.created_at)}. Everything
                changed in the Panel since then (new users, servers, settings) is lost. Files of game servers on your
                nodes are not affected.
            </Confirm>
        </Page>
    );
};
