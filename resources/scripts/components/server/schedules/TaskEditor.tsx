import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { ArchiveIcon, LightningBoltIcon, TerminalIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { Schedule, Task } from '@/api/server/schedules/getServerSchedules';
import createOrUpdateScheduleTask from '@/api/server/schedules/createOrUpdateScheduleTask';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { TextArea, Toggle } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

export const taskActions = () => ({
    command: { label: t('Send a command'), icon: TerminalIcon, hint: t('Types a command into the console.') },
    power: { label: t('Power action'), icon: LightningBoltIcon, hint: t('Starts, stops or restarts the server.') },
    backup: {
        label: t('Create a backup'),
        icon: ArchiveIcon,
        hint: t('Makes a backup, rotating out the oldest one when full.'),
    },
});

export const powerLabels = (): Record<string, string> => ({
    start: t('Start the server'),
    restart: t('Restart the server'),
    stop: t('Stop the server'),
    kill: t('Kill the server'),
});

const COMMANDS = ['save-all', 'say ', 'whitelist reload', 'kick @a', 'tps'];

interface Props {
    open: boolean;
    onClose: () => void;
    schedule: Schedule;
    task?: Task;
}

const TaskEditor = ({ open, onClose, schedule, task }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    const [action, setAction] = useState('command');
    const [payload, setPayload] = useState('');
    const [offset, setOffset] = useState(0);
    const [continueOnFailure, setContinueOnFailure] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setAction(task?.action || 'command');
        setPayload(task?.payload || '');
        setOffset(task?.timeOffset || 0);
        setContinueOnFailure(task?.continueOnFailure || false);
        setError('');
    }, [open]);

    const choose = (next: string) => {
        if (next === action) return;
        setAction(next);
        setPayload(next === 'power' ? 'restart' : '');
    };

    const first = !task
        ? schedule.tasks.length === 0
        : task.sequenceId === Math.min(...schedule.tasks.map((x) => x.sequenceId));
    const invalid = (action === 'command' && !payload.trim()) || (action === 'backup' && backupLimit === 0);

    const save = async () => {
        if (invalid) return;
        setBusy(true);
        setError('');
        try {
            const saved = await createOrUpdateScheduleTask(uuid, schedule.id, task?.id, {
                action,
                payload,
                timeOffset: first ? 0 : offset,
                continueOnFailure,
            });
            const tasks = schedule.tasks.some((x) => x.id === saved.id)
                ? schedule.tasks.map((x) => (x.id === saved.id ? saved : x))
                : [...schedule.tasks, saved];
            appendSchedule({ ...schedule, tasks });
            toast.success(task ? t('Task saved') : t('Task added'));
            onClose();
        } catch (err) {
            setError(httpErrorToHuman(err));
        } finally {
            setBusy(false);
        }
    };

    const actions = taskActions();

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            icon={actions[action as keyof typeof actions]?.icon || TerminalIcon}
            title={task ? t('Edit task') : t('Add a task')}
            description={t('Tasks of a schedule run one after another, from top to bottom.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button loading={busy} disabled={invalid} onClick={save}>
                        {task ? t('Save task') : t('Add task')}
                    </Button>
                </>
            }
        >
            <div className={'space-y-5'}>
                {error && <Callout tone={'red'}>{error}</Callout>}
                <div className={'grid grid-cols-3 gap-2'}>
                    {Object.entries(actions).map(([key, item]) => (
                        <button
                            key={key}
                            type={'button'}
                            onClick={() => choose(key)}
                            className={classNames(
                                'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center ring-1 ring-inset transition-colors',
                                action === key
                                    ? 'bg-raptor-500/10 ring-raptor-500/50 text-gray-50'
                                    : 'ring-gray-800 text-gray-400 hover:text-gray-100 hover:ring-gray-600'
                            )}
                        >
                            <item.icon className={classNames('w-5 h-5', action === key && 'text-raptor-400')} />
                            <span className={'text-xs font-medium leading-tight'}>{item.label}</span>
                        </button>
                    ))}
                </div>

                {action === 'command' && (
                    <div>
                        <TextArea
                            label={t('Command')}
                            value={payload}
                            onChange={setPayload}
                            mono
                            rows={3}
                            placeholder={'say Hello!'}
                        />
                        <div className={'mt-2 flex flex-wrap gap-1.5'}>
                            {COMMANDS.map((command) => (
                                <button
                                    key={command}
                                    type={'button'}
                                    onClick={() => setPayload(command)}
                                    className={
                                        'px-2 py-1 rounded-md font-mono text-[0.7rem] text-gray-400 ring-1 ring-inset ring-gray-700 hover:text-gray-100'
                                    }
                                >
                                    {command.trim()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {action === 'power' && (
                    <div className={'grid grid-cols-2 gap-2'}>
                        {Object.entries(powerLabels()).map(([key, label]) => (
                            <button
                                key={key}
                                type={'button'}
                                onClick={() => setPayload(key)}
                                className={classNames(
                                    'rounded-lg px-3 py-2.5 text-sm text-left ring-1 ring-inset transition-colors',
                                    payload === key
                                        ? key === 'kill'
                                            ? 'bg-rose-500/10 ring-rose-500/50 text-rose-200'
                                            : 'bg-raptor-500/10 ring-raptor-500/50 text-gray-50'
                                        : 'ring-gray-800 text-gray-400 hover:text-gray-100'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {action === 'backup' &&
                    (backupLimit === 0 ? (
                        <Callout tone={'yellow'}>
                            {t('This server cannot have backups, so this task would always fail.')}
                        </Callout>
                    ) : (
                        <TextArea
                            label={t('Files to skip')}
                            value={payload}
                            onChange={setPayload}
                            mono
                            rows={3}
                            placeholder={'logs/\n*.log'}
                            description={t('Optional, one rule per line. Leave it empty to use the .pteroignore file.')}
                        />
                    ))}

                {!first && (
                    <div>
                        <div className={'flex items-center justify-between mb-1.5'}>
                            <span className={'text-xs font-medium text-gray-300'}>{t('Wait before this task')}</span>
                            <span className={'text-sm tabular-nums text-gray-100'}>
                                {offset >= 60
                                    ? t('{{m}} min {{s}} s', { m: Math.floor(offset / 60), s: offset % 60 })
                                    : t('{{s}} s', { s: offset })}
                            </span>
                        </div>
                        <input
                            type={'range'}
                            min={0}
                            max={900}
                            step={5}
                            value={offset}
                            onChange={(e) => setOffset(Number(e.target.value))}
                            className={'w-full accent-raptor-500'}
                        />
                        <p className={'mt-1 text-xs text-gray-500'}>
                            {t('Counted from the end of the previous task, up to 15 minutes.')}
                        </p>
                    </div>
                )}
                <Toggle
                    label={t('Continue on failure')}
                    description={t('Run the next tasks even if this one fails.')}
                    checked={continueOnFailure}
                    onChange={setContinueOnFailure}
                />
            </div>
        </Modal>
    );
};

export default TaskEditor;
