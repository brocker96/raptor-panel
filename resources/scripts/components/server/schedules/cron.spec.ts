import { describe, expect, it } from 'vitest';
import { describeCron, fromCron, toCron } from '@/components/server/schedules/cron';

const cron = (minute: string, hour: string, dayOfMonth = '*', month = '*', dayOfWeek = '*') => ({
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
});

describe('schedule cron helpers', () => {
    it('recognises the expressions of the friendly editor', () => {
        expect(fromCron(cron('*/5', '*'))).toEqual({ kind: 'minutes', every: 5 });
        expect(fromCron(cron('*', '*'))).toEqual({ kind: 'minutes', every: 1 });
        expect(fromCron(cron('15', '*'))).toEqual({ kind: 'hourly', every: 1, minute: 15 });
        expect(fromCron(cron('0', '*/6'))).toEqual({ kind: 'hourly', every: 6, minute: 0 });
        expect(fromCron(cron('30', '4'))).toEqual({ kind: 'daily', time: '04:30' });
        expect(fromCron(cron('0', '20', '*', '*', '1,5'))).toEqual({ kind: 'weekly', days: [1, 5], time: '20:00' });
        expect(fromCron(cron('0', '3', '1'))).toEqual({ kind: 'monthly', day: 1, time: '03:00' });
        expect(fromCron(cron('0', '3', '*', '6'))).toEqual({ kind: 'custom' });
        expect(fromCron(cron('0-10', '3'))).toEqual({ kind: 'custom' });
    });

    it('round trips every frequency', () => {
        const fallback = cron('1', '2', '3', '4', '5');
        for (const expression of [
            cron('*/10', '*'),
            cron('5', '*/2'),
            cron('30', '4'),
            cron('0', '20', '*', '*', '0,6'),
            cron('0', '3', '15'),
        ]) {
            expect(toCron(fromCron(expression), fallback)).toEqual(expression);
        }
        expect(toCron({ kind: 'custom' }, fallback)).toBe(fallback);
    });

    it('describes schedules in words', () => {
        expect(describeCron(cron('*/5', '*'))).toBe('Every 5 minutes');
        expect(describeCron(cron('30', '4'))).toBe('Every day at 04:30');
        expect(describeCron(cron('0', '9', '*', '*', '1,2,3,4,5'))).toBe('Every weekday at 09:00');
        expect(describeCron(cron('0', '20', '*', '*', '6,0'))).toBe('Every Saturday and Sunday at 20:00');
        expect(describeCron(cron('0', '3', '*', '6'))).toBeNull();
    });
});
