import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, ClockIcon, PlusIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerSchedules, { Schedule } from '@/api/server/schedules/getServerSchedules';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { ago } from '@/components/admin/ui/hooks';
import ScheduleEditor from '@/components/server/schedules/ScheduleEditor';
import { cronString, describeCron, nextRunText } from '@/components/server/schedules/cron';
import { taskActions } from '@/components/server/schedules/TaskEditor';
import { usePermissions } from '@/plugins/usePermissions';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

export const ScheduleStatus = ({ schedule }: { schedule: Schedule }) =>
    schedule.isProcessing ? (
        <Badge tone={'blue'} dot>
            {t('Running')}
        </Badge>
    ) : schedule.isActive ? (
        <Badge tone={'green'} dot>
            {t('Active')}
        </Badge>
    ) : (
        <Badge tone={'gray'}>{t('Paused')}</Badge>
    );

const ScheduleCard = ({ schedule }: { schedule: Schedule }) => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const actions = taskActions();
    const kinds = [...new Set(schedule.tasks.map((task) => task.action))];

    return (
        <li>
            <Link
                to={`/server/${id}/schedules/${schedule.id}`}
                className={'group flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-white/[0.02] transition-colors'}
            >
                <span
                    className={classNames(
                        'grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl ring-1 ring-inset',
                        schedule.isActive
                            ? 'bg-raptor-500/10 text-raptor-300 ring-raptor-500/20'
                            : 'bg-gray-800 text-gray-500 ring-gray-700'
                    )}
                >
                    <ClockIcon
                        className={classNames(
                            'w-5 h-5',
                            schedule.isProcessing && 'animate-spin [animation-duration:3s]'
                        )}
                    />
                </span>
                <div className={'min-w-0 flex-1'}>
                    <p className={'flex flex-wrap items-center gap-2 text-sm text-gray-50'}>
                        <span className={'break-all'}>{schedule.name}</span>
                        <ScheduleStatus schedule={schedule} />
                    </p>
                    <p className={'mt-0.5 text-xs text-gray-400'}>
                        {describeCron(schedule.cron) || (
                            <code className={'text-gray-500'}>{cronString(schedule.cron)}</code>
                        )}
                        {schedule.isActive && schedule.nextRunAt && (
                            <span className={'text-gray-500'}>
                                {' '}
                                · {t('next {{when}}', { when: nextRunText(schedule.nextRunAt, ago) })}
                            </span>
                        )}
                    </p>
                </div>
                <div className={'hidden sm:flex items-center gap-1.5 text-gray-500'}>
                    {kinds.map((kind) => {
                        const Icon = actions[kind as keyof typeof actions]?.icon;

                        return Icon ? (
                            <span key={kind} title={actions[kind as keyof typeof actions].label}>
                                <Icon className={'w-4 h-4'} />
                            </span>
                        ) : null;
                    })}
                    <span className={'ml-1 text-xs'}>{t('{{count}} tasks', { count: schedule.tasks.length })}</span>
                </div>
                <ChevronRightIcon className={'w-4 h-4 text-gray-600 group-hover:text-gray-300'} />
            </Link>
        </li>
    );
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const schedules = ServerContext.useStoreState((state) => state.schedules.data);
    const setSchedules = ServerContext.useStoreActions((actions) => actions.schedules.setSchedules);
    const [canCreate] = usePermissions(['schedule.create']);
    const [loading, setLoading] = useState(!schedules.length);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        getServerSchedules(uuid)
            .then(setSchedules)
            .catch((err) => setError(httpErrorToHuman(err)))
            .then(() => setLoading(false));
    }, []);

    const sorted = [...schedules].sort(
        (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
    );

    return (
        <ServerContentBlock
            title={t('Schedules')}
            icon={ClockIcon}
            description={t('Restart, back up and run commands automatically, for example every night or every hour.')}
            actions={
                canCreate ? (
                    <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                        {t('New schedule')}
                    </Button>
                ) : undefined
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{error}</Callout>
                </div>
            )}
            {loading ? (
                <Skeleton className={'h-48 rounded-xl'} />
            ) : sorted.length ? (
                <ul
                    className={
                        'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 divide-y divide-gray-800 overflow-hidden'
                    }
                >
                    {sorted.map((schedule) => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                    ))}
                </ul>
            ) : (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={ClockIcon}
                        title={t('No schedules yet')}
                        description={t(
                            'Start with a template such as a daily restart or a nightly backup, it takes a few seconds.'
                        )}
                        action={
                            canCreate ? (
                                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                                    {t('New schedule')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            )}
            <ScheduleEditor open={creating} onClose={() => setCreating(false)} />
        </ServerContentBlock>
    );
};
