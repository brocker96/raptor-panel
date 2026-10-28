import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import isEqual from 'react-fast-compare';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerSchedule from '@/api/server/schedules/getServerSchedule';
import deleteSchedule from '@/api/server/schedules/deleteSchedule';
import deleteScheduleTask from '@/api/server/schedules/deleteScheduleTask';
import triggerScheduleExecution from '@/api/server/schedules/triggerScheduleExecution';
import { Task } from '@/api/server/schedules/getServerSchedules';
import PageContentBlock from '@/components/elements/PageContentBlock';
import Menu from '@/components/ui/Menu';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { ago } from '@/components/admin/ui/hooks';
import ScheduleEditor from '@/components/server/schedules/ScheduleEditor';
import TaskEditor, { powerLabels, taskActions } from '@/components/server/schedules/TaskEditor';
import { ScheduleStatus } from '@/components/server/schedules/ScheduleContainer';
import { cronString, describeCron, nextRunText } from '@/components/server/schedules/cron';
import { usePermissions } from '@/plugins/usePermissions';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const Info = ({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) => (
    <div className={'min-w-0'} title={title}>
        <p className={'text-xs text-gray-500'}>{label}</p>
        <p className={'mt-0.5 text-sm text-gray-100 truncate'}>{value}</p>
    </div>
);

const delay = (seconds: number) =>
    seconds >= 60
        ? t('{{m}} min {{s}} s', { m: Math.floor(seconds / 60), s: seconds % 60 })
        : t('{{s}} s', { s: seconds });

export default () => {
    const navigate = useNavigate();
    const { id: scheduleId } = useParams<{ id: string }>();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const schedule = ServerContext.useStoreState(
        (st) => st.schedules.data.find((s) => s.id === Number(scheduleId)),
        isEqual
    );
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);
    const removeSchedule = ServerContext.useStoreActions((actions) => actions.schedules.removeSchedule);
    const [canUpdate, canDelete] = usePermissions(['schedule.update', 'schedule.delete']);

    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [task, setTask] = useState<Task | 'new' | null>(null);
    const [removingTask, setRemovingTask] = useState<Task | null>(null);
    const [removing, setRemoving] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getServerSchedule(uuid, Number(scheduleId))
            .then(appendSchedule)
            .catch((err) => setError(httpErrorToHuman(err)));
    }, [scheduleId]);

    useEffect(() => {
        document.title = `${name} | ${schedule?.name || t('Schedules')}`;
    }, [schedule?.name]);

    const back = `/server/${id}/schedules`;

    if (error && !schedule) {
        return (
            <PageContentBlock>
                <Callout tone={'red'}>{error}</Callout>
            </PageContentBlock>
        );
    }

    if (!schedule) {
        return (
            <PageContentBlock>
                <Skeleton className={'h-10 w-64 mb-6'} />
                <Skeleton className={'h-72 rounded-xl'} />
            </PageContentBlock>
        );
    }

    const tasks = [...schedule.tasks].sort((a, b) => a.sequenceId - b.sequenceId);
    const actions = taskActions();
    const power = powerLabels();

    const run = async () => {
        setBusy(true);
        try {
            await triggerScheduleExecution(uuid, schedule.id);
            appendSchedule({ ...schedule, isProcessing: true });
            toast.success(t('Schedule started'), schedule.name);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const removeTask = async () => {
        if (!removingTask) return;
        setBusy(true);
        try {
            await deleteScheduleTask(uuid, schedule.id, removingTask.id);
            appendSchedule({ ...schedule, tasks: schedule.tasks.filter((x) => x.id !== removingTask.id) });
            toast.success(t('Task deleted'));
            setRemovingTask(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            await deleteSchedule(uuid, schedule.id);
            removeSchedule(schedule.id);
            toast.success(t('Schedule deleted'), schedule.name);
            navigate(back);
        } catch (err) {
            toast.fromError(err);
            setBusy(false);
        }
    };

    return (
        <PageContentBlock>
            <Button variant={'ghost'} size={'sm'} icon={ArrowLeftIcon} to={back} className={'-ml-2 mb-3'}>
                {t('Schedules')}
            </Button>
            <div className={'mb-6 flex flex-col sm:flex-row sm:items-start gap-4'}>
                <div className={'min-w-0 flex-1'}>
                    <h1
                        className={
                            'flex flex-wrap items-center gap-3 text-2xl sm:text-[1.7rem] font-semibold text-gray-50'
                        }
                    >
                        <span className={'break-words'}>{schedule.name}</span>
                        <ScheduleStatus schedule={schedule} />
                    </h1>
                    <p className={'mt-1 text-sm text-gray-400'}>
                        {describeCron(schedule.cron) || t('Custom schedule')}
                        {schedule.onlyWhenOnline && ' · ' + t('only while the server is online')}
                    </p>
                </div>
                <div className={'flex flex-wrap items-center gap-2'}>
                    {canUpdate && (
                        <>
                            <Button
                                variant={'secondary'}
                                icon={PlayIcon}
                                loading={busy && !removing && !removingTask}
                                disabled={schedule.isProcessing || !tasks.length}
                                title={!tasks.length ? t('Add a task first') : undefined}
                                onClick={run}
                            >
                                {t('Run now')}
                            </Button>
                            <Button variant={'secondary'} icon={PencilIcon} onClick={() => setEditing(true)}>
                                {t('Edit')}
                            </Button>
                        </>
                    )}
                    {canDelete && (
                        <Button
                            variant={'ghost'}
                            icon={TrashIcon}
                            aria-label={t('Delete schedule')}
                            title={t('Delete schedule')}
                            onClick={() => setRemoving(true)}
                        />
                    )}
                </div>
            </div>

            <div
                className={
                    'mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl ring-1 ring-gray-800 bg-gray-900/40 px-4 sm:px-5 py-4'
                }
            >
                <Info
                    label={t('Cron expression')}
                    value={<code className={'text-[0.8rem]'}>{cronString(schedule.cron)}</code>}
                />
                <Info
                    label={t('Next run')}
                    value={schedule.isActive ? nextRunText(schedule.nextRunAt, ago) : '—'}
                    title={schedule.nextRunAt ? format(schedule.nextRunAt, 'PPpp') : undefined}
                />
                <Info
                    label={t('Last run')}
                    value={schedule.lastRunAt ? ago(schedule.lastRunAt.toISOString()) : t('Never')}
                    title={schedule.lastRunAt ? format(schedule.lastRunAt, 'PPpp') : undefined}
                />
                <Info label={t('Tasks')} value={tasks.length} />
            </div>

            <div className={'flex items-center justify-between mb-3'}>
                <h2 className={'text-base font-semibold text-gray-100'}>{t('Tasks')}</h2>
                {canUpdate && tasks.length > 0 && (
                    <Button size={'sm'} icon={PlusIcon} onClick={() => setTask('new')}>
                        {t('Add task')}
                    </Button>
                )}
            </div>

            {!tasks.length ? (
                <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40'}>
                    <EmptyState
                        icon={ClockIcon}
                        title={t('This schedule has no tasks')}
                        description={t('Add what should happen, for example a warning in chat followed by a restart.')}
                        action={
                            canUpdate ? (
                                <Button icon={PlusIcon} onClick={() => setTask('new')}>
                                    {t('Add task')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            ) : (
                <ol className={'relative'}>
                    {tasks.map((item, index) => {
                        const meta = actions[item.action as keyof typeof actions];
                        const Icon = meta?.icon || ClockIcon;

                        return (
                            <li key={item.id} className={'relative pl-12 pb-4 last:pb-0'}>
                                {index < tasks.length - 1 && (
                                    <span className={'absolute left-[1.15rem] top-10 bottom-0 w-px bg-gray-800'} />
                                )}
                                <span
                                    className={classNames(
                                        'absolute left-0 top-1.5 grid place-items-center w-9 h-9 rounded-xl ring-1 ring-inset',
                                        item.isQueued
                                            ? 'bg-sky-500/10 text-sky-300 ring-sky-500/30 animate-pulse'
                                            : 'bg-gray-900 text-gray-300 ring-gray-700'
                                    )}
                                >
                                    <Icon className={'w-4 h-4'} />
                                </span>
                                {index > 0 && item.timeOffset > 0 && (
                                    <p className={'mb-1.5 flex items-center gap-1.5 text-xs text-gray-500'}>
                                        <ClockIcon className={'w-3.5 h-3.5'} />
                                        {t('wait {{time}}', { time: delay(item.timeOffset) })}
                                    </p>
                                )}
                                <div
                                    className={
                                        'flex items-start gap-3 rounded-xl ring-1 ring-gray-800 bg-gray-900/40 px-4 py-3'
                                    }
                                >
                                    <div className={'min-w-0 flex-1'}>
                                        <p className={'flex flex-wrap items-center gap-2 text-sm text-gray-100'}>
                                            <span className={'text-gray-500 tabular-nums'}>{index + 1}.</span>
                                            {meta?.label || item.action}
                                            {item.isQueued && <Badge tone={'blue'}>{t('Queued')}</Badge>}
                                            {item.continueOnFailure && (
                                                <Badge tone={'yellow'}>{t('Continues on failure')}</Badge>
                                            )}
                                        </p>
                                        {item.action === 'power' ? (
                                            <p className={'mt-1 text-sm text-gray-400'}>
                                                {power[item.payload] || item.payload}
                                            </p>
                                        ) : item.payload ? (
                                            <pre
                                                className={
                                                    'mt-1.5 rounded-lg bg-gray-950/60 px-2.5 py-1.5 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all'
                                                }
                                            >
                                                {item.payload}
                                            </pre>
                                        ) : item.action === 'backup' ? (
                                            <p className={'mt-1 text-xs text-gray-500'}>
                                                {t('Uses the .pteroignore file')}
                                            </p>
                                        ) : null}
                                    </div>
                                    {canUpdate && (
                                        <Menu
                                            items={[
                                                { label: t('Edit'), icon: PencilIcon, onClick: () => setTask(item) },
                                                {
                                                    label: t('Delete'),
                                                    icon: TrashIcon,
                                                    danger: true,
                                                    onClick: () => setRemovingTask(item),
                                                },
                                            ]}
                                        />
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <ScheduleEditor open={editing} onClose={() => setEditing(false)} schedule={schedule} />
            <TaskEditor
                open={task !== null}
                onClose={() => setTask(null)}
                schedule={schedule}
                task={task && task !== 'new' ? task : undefined}
            />
            <Confirm
                open={!!removingTask}
                title={t('Delete this task?')}
                confirm={t('Delete task')}
                loading={busy}
                onConfirm={removeTask}
                onClose={() => setRemovingTask(null)}
            >
                {t('The task is removed from the schedule. The other tasks keep their order.')}
            </Confirm>
            <Confirm
                open={removing}
                title={t('Delete {{name}}?', { name: schedule.name })}
                confirm={t('Delete schedule')}
                loading={busy}
                onConfirm={remove}
                onClose={() => setRemoving(false)}
            >
                {t('The schedule and all of its tasks are deleted. Running tasks are not interrupted.')}
            </Confirm>
        </PageContentBlock>
    );
};
