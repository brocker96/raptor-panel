import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import classNames from 'classnames';
import { t } from '@/i18n';

interface Props {
    cron: Schedule['cron'];
    className?: string;
}

const ScheduleCronRow = ({ cron, className }: Props) => (
    <div className={classNames('flex', className)}>
        <div className={'w-1/5 sm:w-auto text-center'}>
            <p className={'font-medium'}>{cron.minute}</p>
            <p className={'text-2xs text-neutral-500 uppercase'}>{t('Minute')}</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-medium'}>{cron.hour}</p>
            <p className={'text-2xs text-neutral-500 uppercase'}>{t('Hour')}</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-medium'}>{cron.dayOfMonth}</p>
            <p className={'text-2xs text-neutral-500 uppercase'}>{t('Day (Month)')}</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-medium'}>{cron.month}</p>
            <p className={'text-2xs text-neutral-500 uppercase'}>{t('Month')}</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-medium'}>{cron.dayOfWeek}</p>
            <p className={'text-2xs text-neutral-500 uppercase'}>{t('Day (Week)')}</p>
        </div>
    </div>
);

export default ScheduleCronRow;
