import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useNavigate } from 'react-router-dom';
import { ArchiveIcon, ClockIcon, RefreshIcon, SaveIcon, SparklesIcon, TerminalIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import createOrUpdateSchedule from '@/api/server/schedules/createOrUpdateSchedule';
import createOrUpdateScheduleTask from '@/api/server/schedules/createOrUpdateScheduleTask';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { TextInput, Toggle } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import {
    Cron,
    Frequency,
    cronString,
    describeCron,
    fromCron,
    mondayFirst,
    toCron,
    weekday,
} from '@/components/server/schedules/cron';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

interface Template {
    key: string;
    name: string;
    description: string;
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    cron: Cron;
    tasks: { action: string; payload: string; timeOffset: number }[];
}

const templates = (): Template[] => [
    {
        key: 'restart',
        name: t('Daily restart'),
        description: t('Warns the players, saves the world and restarts every night at 04:00.'),
        icon: RefreshIcon,
        cron: { minute: '0', hour: '4', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
        tasks: [
            { action: 'command', payload: 'say ' + t('The server restarts in 60 seconds!'), timeOffset: 0 },
            { action: 'command', payload: 'say ' + t('The server restarts in 10 seconds!'), timeOffset: 50 },
            { action: 'command', payload: 'save-all', timeOffset: 5 },
            { action: 'power', payload: 'restart', timeOffset: 5 },
        ],
    },
    {
        key: 'backup',
        name: t('Nightly backup'),
        description: t(
            'Creates a backup every night at 03:00, the oldest one is rotated out when the limit is reached.'
        ),
        icon: ArchiveIcon,
        cron: { minute: '0', hour: '3', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
        tasks: [{ action: 'backup', payload: '', timeOffset: 0 }],
    },
    {
        key: 'save',
        name: t('Autosave'),
        description: t('Runs save-all every 30 minutes so a crash never loses much progress.'),
        icon: SaveIcon,
        cron: { minute: '*/30', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
        tasks: [{ action: 'command', payload: 'save-all', timeOffset: 0 }],
    },
    {
        key: 'announce',
        name: t('Announcement'),
        description: t('Broadcasts a message to every player each hour.'),
        icon: TerminalIcon,
        cron: { minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
        tasks: [{ action: 'command', payload: 'say ' + t('Join our Discord!'), timeOffset: 0 }],
    },
];

const DEFAULT_CRON: Cron = { minute: '0', hour: '4', dayOfMonth: '*', month: '*', dayOfWeek: '*' };

const control =
    'h-10 rounded-lg bg-gray-950/60 px-3 text-sm text-gray-100 ring-1 ring-inset ring-gray-700 focus:outline-none focus:ring-2 focus:ring-raptor-500';

const FrequencyPicker = ({ cron, onChange }: { cron: Cron; onChange: (cron: Cron) => void }) => {
    const [frequency, setFrequency] = useState<Frequency>(() => fromCron(cron));

    const update = (next: Frequency) => {
        setFrequency(next);
        if (next.kind !== 'custom') onChange(toCron(next, cron));
    };

    const time = 'time' in frequency ? frequency.time : '04:00';
    const kinds: { kind: Frequency['kind']; label: string; make: () => Frequency }[] = [
        { kind: 'minutes', label: t('Minutes'), make: () => ({ kind: 'minutes', every: 15 }) },
        { kind: 'hourly', label: t('Hourly'), make: () => ({ kind: 'hourly', every: 1, minute: 0 }) },
        { kind: 'daily', label: t('Daily'), make: () => ({ kind: 'daily', time }) },
        { kind: 'weekly', label: t('Weekly'), make: () => ({ kind: 'weekly', days: [1], time }) },
        { kind: 'monthly', label: t('Monthly'), make: () => ({ kind: 'monthly', day: 1, time }) },
        { kind: 'custom', label: t('Cron'), make: () => ({ kind: 'custom' }) },
    ];

    const field = (key: keyof Cron, label: string) => (
        <label className={'min-w-0'}>
            <span className={'block mb-1 text-[0.7rem] text-gray-500'}>{label}</span>
            <input
                value={cron[key]}
                onChange={(e) => onChange({ ...cron, [key]: e.target.value.trim() })}
                className={classNames(control, 'w-full font-mono text-center')}
            />
        </label>
    );

    return (
        <div className={'space-y-3'}>
            <div
                className={
                    'grid grid-cols-3 sm:grid-cols-6 gap-1 rounded-xl bg-gray-950/50 p-1 ring-1 ring-inset ring-gray-800'
                }
            >
                {kinds.map((item) => (
                    <button
                        key={item.kind}
                        type={'button'}
                        onClick={() => frequency.kind !== item.kind && update(item.make())}
                        className={classNames(
                            'rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                            frequency.kind === item.kind
                                ? 'bg-raptor-500 text-gray-950'
                                : 'text-gray-400 hover:text-gray-100'
                        )}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {frequency.kind === 'minutes' && (
                <div className={'flex flex-wrap items-center gap-2 text-sm text-gray-300'}>
                    {t('Every')}
                    <select
                        value={frequency.every}
                        onChange={(e) => update({ kind: 'minutes', every: Number(e.target.value) })}
                        className={control}
                    >
                        {[1, 2, 5, 10, 15, 20, 30].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                    {t('minutes')}
                </div>
            )}
            {frequency.kind === 'hourly' && (
                <div className={'flex flex-wrap items-center gap-2 text-sm text-gray-300'}>
                    {t('Every')}
                    <select
                        value={frequency.every}
                        onChange={(e) => update({ ...frequency, every: Number(e.target.value) })}
                        className={control}
                    >
                        {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                    {t('hours at minute')}
                    <input
                        type={'number'}
                        min={0}
                        max={59}
                        value={frequency.minute}
                        onChange={(e) =>
                            update({ ...frequency, minute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })
                        }
                        className={classNames(control, 'w-20')}
                    />
                </div>
            )}
            {(frequency.kind === 'daily' || frequency.kind === 'weekly' || frequency.kind === 'monthly') && (
                <div className={'space-y-3'}>
                    {frequency.kind === 'weekly' && (
                        <div className={'grid grid-cols-7 gap-1'}>
                            {mondayFirst([0, 1, 2, 3, 4, 5, 6]).map((day) => {
                                const on = frequency.days.includes(day);

                                return (
                                    <button
                                        key={day}
                                        type={'button'}
                                        onClick={() =>
                                            update({
                                                ...frequency,
                                                days: on
                                                    ? frequency.days.filter((d) => d !== day)
                                                    : [...frequency.days, day],
                                            })
                                        }
                                        className={classNames(
                                            'rounded-lg py-2 text-xs font-medium ring-1 ring-inset transition-colors',
                                            on
                                                ? 'bg-raptor-500/15 text-raptor-200 ring-raptor-500/40'
                                                : 'text-gray-400 ring-gray-700 hover:text-gray-100'
                                        )}
                                    >
                                        {weekday(day, 'short')}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className={'flex flex-wrap items-center gap-2 text-sm text-gray-300'}>
                        {frequency.kind === 'monthly' && (
                            <>
                                {t('On day')}
                                <select
                                    value={frequency.day}
                                    onChange={(e) => update({ ...frequency, day: Number(e.target.value) })}
                                    className={control}
                                >
                                    {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                        {t('at')}
                        <input
                            type={'time'}
                            value={frequency.time}
                            onChange={(e) => update({ ...frequency, time: e.target.value || '00:00' })}
                            className={classNames(control, '[color-scheme:dark]')}
                        />
                    </div>
                </div>
            )}
            {frequency.kind === 'custom' && (
                <div className={'grid grid-cols-5 gap-2'}>
                    {field('minute', t('Minute'))}
                    {field('hour', t('Hour'))}
                    {field('dayOfMonth', t('Day'))}
                    {field('month', t('Month'))}
                    {field('dayOfWeek', t('Weekday'))}
                </div>
            )}

            <div
                className={
                    'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-950/40 px-3 py-2 ring-1 ring-inset ring-gray-800'
                }
            >
                <ClockIcon className={'w-4 h-4 text-raptor-400'} />
                <span className={'text-sm text-gray-100'}>{describeCron(cron) || t('Custom schedule')}</span>
                <code className={'ml-auto text-xs text-gray-500'}>{cronString(cron)}</code>
            </div>
            {(frequency.kind === 'daily' || frequency.kind === 'weekly' || frequency.kind === 'monthly') && (
                <p className={'text-xs text-gray-500'}>{t('Times use the timezone of the panel.')}</p>
            )}
        </div>
    );
};

interface Props {
    open: boolean;
    onClose: () => void;
    schedule?: Schedule;
}

const ScheduleEditor = ({ open, onClose, schedule }: Props) => {
    const navigate = useNavigate();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    const [template, setTemplate] = useState<Template | null>(null);
    const [name, setName] = useState('');
    const [cron, setCron] = useState<Cron>(DEFAULT_CRON);
    const [active, setActive] = useState(true);
    const [onlineOnly, setOnlineOnly] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!open) return;
        setTemplate(null);
        setName(schedule?.name || '');
        setCron(schedule?.cron || DEFAULT_CRON);
        setActive(schedule?.isActive ?? true);
        setOnlineOnly(schedule?.onlyWhenOnline ?? true);
        setError('');
        setVersion((v) => v + 1);
    }, [open]);

    const pick = (next: Template | null) => {
        setTemplate(next);
        setName(next ? next.name : '');
        setCron(next ? next.cron : DEFAULT_CRON);
        setOnlineOnly(next?.key !== 'backup');
        setVersion((v) => v + 1);
    };

    const save = async () => {
        if (!name.trim()) return;
        setBusy(true);
        setError('');
        try {
            let saved = await createOrUpdateSchedule(uuid, {
                id: schedule?.id,
                name: name.trim(),
                cron,
                isActive: active,
                onlyWhenOnline: onlineOnly,
            });

            if (!schedule && template) {
                const tasks = [];
                for (const task of template.tasks) {
                    if (task.action === 'backup' && backupLimit === 0) continue;
                    tasks.push(
                        await createOrUpdateScheduleTask(uuid, saved.id, undefined, {
                            ...task,
                            continueOnFailure: false,
                        })
                    );
                }
                saved = { ...saved, tasks };
            }

            appendSchedule(schedule ? { ...saved, tasks: schedule.tasks } : saved);
            toast.success(schedule ? t('Schedule saved') : t('Schedule created'), saved.name);
            onClose();
            if (!schedule) navigate(`/server/${id}/schedules/${saved.id}`);
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
            size={'lg'}
            icon={ClockIcon}
            title={schedule ? t('Edit schedule') : t('New schedule')}
            description={t('Schedules run tasks such as commands, restarts and backups automatically.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button loading={busy} disabled={!name.trim()} onClick={save}>
                        {schedule
                            ? t('Save schedule')
                            : template
                            ? t('Create with {{count}} tasks', { count: template.tasks.length })
                            : t('Create schedule')}
                    </Button>
                </>
            }
        >
            <div className={'space-y-5'}>
                {error && <Callout tone={'red'}>{error}</Callout>}
                {!schedule && (
                    <div>
                        <p
                            className={
                                'mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500'
                            }
                        >
                            <SparklesIcon className={'w-3.5 h-3.5'} />
                            {t('Start from a template')}
                        </p>
                        <div className={'grid sm:grid-cols-2 gap-2'}>
                            {templates().map((item) => (
                                <button
                                    key={item.key}
                                    type={'button'}
                                    onClick={() => pick(template?.key === item.key ? null : item)}
                                    className={classNames(
                                        'flex items-start gap-3 rounded-xl p-3 text-left ring-1 ring-inset transition-colors',
                                        template?.key === item.key
                                            ? 'bg-raptor-500/10 ring-raptor-500/50'
                                            : 'bg-gray-950/30 ring-gray-800 hover:ring-gray-600'
                                    )}
                                >
                                    <item.icon
                                        className={classNames(
                                            'w-5 h-5 mt-0.5 flex-shrink-0',
                                            template?.key === item.key ? 'text-raptor-400' : 'text-gray-500'
                                        )}
                                    />
                                    <span className={'min-w-0'}>
                                        <span className={'block text-sm font-medium text-gray-100'}>{item.name}</span>
                                        <span className={'block mt-0.5 text-xs text-gray-400 leading-relaxed'}>
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <TextInput
                    label={t('Name')}
                    value={name}
                    onChange={setName}
                    placeholder={t('Nightly restart')}
                    maxLength={191}
                    required
                />
                <div>
                    <p className={'mb-2 text-xs font-medium text-gray-300'}>{t('When')}</p>
                    <FrequencyPicker key={version} cron={cron} onChange={setCron} />
                </div>
                <div className={'grid sm:grid-cols-2 gap-3'}>
                    <Toggle
                        label={t('Enabled')}
                        description={t('Runs automatically at the chosen times.')}
                        checked={active}
                        onChange={setActive}
                    />
                    <Toggle
                        label={t('Only while online')}
                        description={t('Skips the run when the server is stopped.')}
                        checked={onlineOnly}
                        onChange={setOnlineOnly}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default ScheduleEditor;
