import i18n, { t } from '@/i18n';
import { Schedule } from '@/api/server/schedules/getServerSchedules';

export type Cron = Schedule['cron'];

export type Frequency =
    | { kind: 'minutes'; every: number }
    | { kind: 'hourly'; every: number; minute: number }
    | { kind: 'daily'; time: string }
    | { kind: 'weekly'; days: number[]; time: string }
    | { kind: 'monthly'; day: number; time: string }
    | { kind: 'custom' };

const int = (value: string) => (/^\d+$/.test(value) ? Number(value) : null);
const pad = (n: number) => String(n).padStart(2, '0');

const splitTime = (time: string): [number, number] => {
    const [h, m] = time.split(':').map(Number);

    return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
};

/** Recognises the cron expressions the friendly editor can produce. */
export const fromCron = (cron: Cron): Frequency => {
    const { minute, hour, dayOfMonth, month, dayOfWeek } = cron;
    if (month !== '*') return { kind: 'custom' };

    const everyMinutes = /^\*\/(\d+)$/.exec(minute);
    if (hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
        if (minute === '*') return { kind: 'minutes', every: 1 };
        if (everyMinutes) return { kind: 'minutes', every: Number(everyMinutes[1]) };
        if (int(minute) !== null) return { kind: 'hourly', every: 1, minute: int(minute)! };
    }

    const everyHours = /^\*\/(\d+)$/.exec(hour);
    if (everyHours && int(minute) !== null && dayOfMonth === '*' && dayOfWeek === '*') {
        return { kind: 'hourly', every: Number(everyHours[1]), minute: int(minute)! };
    }

    if (int(minute) === null || int(hour) === null) return { kind: 'custom' };
    const time = `${pad(int(hour)!)}:${pad(int(minute)!)}`;

    if (dayOfMonth === '*' && dayOfWeek === '*') return { kind: 'daily', time };
    if (dayOfMonth === '*' && /^\d(,\d)*$/.test(dayOfWeek)) {
        return {
            kind: 'weekly',
            days: dayOfWeek
                .split(',')
                .map(Number)
                .map((d) => d % 7),
            time,
        };
    }
    if (int(dayOfMonth) !== null && dayOfWeek === '*') return { kind: 'monthly', day: int(dayOfMonth)!, time };

    return { kind: 'custom' };
};

export const toCron = (frequency: Frequency, fallback: Cron): Cron => {
    const base = { month: '*', dayOfMonth: '*', dayOfWeek: '*' };

    switch (frequency.kind) {
        case 'minutes':
            return { ...base, minute: frequency.every <= 1 ? '*' : `*/${frequency.every}`, hour: '*' };
        case 'hourly':
            return {
                ...base,
                minute: String(frequency.minute),
                hour: frequency.every <= 1 ? '*' : `*/${frequency.every}`,
            };
        case 'daily': {
            const [h, m] = splitTime(frequency.time);
            return { ...base, minute: String(m), hour: String(h) };
        }
        case 'weekly': {
            const [h, m] = splitTime(frequency.time);
            const days = [...new Set(frequency.days)].sort();
            return { ...base, minute: String(m), hour: String(h), dayOfWeek: days.length ? days.join(',') : '*' };
        }
        case 'monthly': {
            const [h, m] = splitTime(frequency.time);
            return { ...base, minute: String(m), hour: String(h), dayOfMonth: String(frequency.day) };
        }
        default:
            return fallback;
    }
};

/** Localised name of a week day, 0 is Sunday like in cron. */
export const weekday = (day: number, style: 'long' | 'short' = 'long') =>
    new Intl.DateTimeFormat(i18n.language || 'en', { weekday: style }).format(new Date(2024, 0, 7 + (day % 7)));

/** Sorts week days starting with Monday, the way people read them. */
export const mondayFirst = (days: number[]) => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

const list = (items: string[]) => {
    try {
        return new Intl.ListFormat(i18n.language || 'en', { type: 'conjunction' }).format(items);
    } catch {
        return items.join(', ');
    }
};

/** A sentence describing when the schedule runs, or null for expressions it does not understand. */
export const describeCron = (cron: Cron): string | null => {
    const frequency = fromCron(cron);

    switch (frequency.kind) {
        case 'minutes':
            return frequency.every <= 1 ? t('Every minute') : t('Every {{count}} minutes', { count: frequency.every });
        case 'hourly':
            return frequency.every <= 1
                ? t('Every hour at minute {{minute}}', { minute: frequency.minute })
                : t('Every {{count}} hours at minute {{minute}}', { count: frequency.every, minute: frequency.minute });
        case 'daily':
            return t('Every day at {{time}}', { time: frequency.time });
        case 'weekly':
            return frequency.days.length === 5 && [1, 2, 3, 4, 5].every((d) => frequency.days.includes(d))
                ? t('Every weekday at {{time}}', { time: frequency.time })
                : t('Every {{days}} at {{time}}', {
                      days: list(mondayFirst(frequency.days).map((d) => weekday(d))),
                      time: frequency.time,
                  });
        case 'monthly':
            return t('On day {{day}} of every month at {{time}}', { day: frequency.day, time: frequency.time });
        default:
            return null;
    }
};

export const cronString = (cron: Cron) =>
    `${cron.minute} ${cron.hour} ${cron.dayOfMonth} ${cron.month} ${cron.dayOfWeek}`;

/** When the schedule runs next, a date in the past means the run is waiting for the queue. */
export const nextRunText = (date: Date | null, ago: (date: string) => string) =>
    !date ? '—' : date.getTime() > Date.now() ? ago(date.toISOString()) : t('due now');
