import { ExclamationIcon, ShieldExclamationIcon } from '@heroicons/react/outline';
import React from 'react';
import classNames from 'classnames';

interface AlertProps {
    type: 'warning' | 'danger';
    className?: string;
    children: React.ReactNode;
}

export default ({ type, className, children }: AlertProps) => {
    return (
        <div
            className={classNames(
                'flex items-center gap-3 text-sm text-gray-100 rounded-lg px-4 py-3 ring-1 ring-inset',
                {
                    ['bg-red-500/10 ring-red-500/30']: type === 'danger',
                    ['bg-yellow-500/10 ring-yellow-500/30']: type === 'warning',
                },
                className
            )}
        >
            {type === 'danger' ? (
                <ShieldExclamationIcon className={'w-5 h-5 flex-shrink-0 text-red-400'} />
            ) : (
                <ExclamationIcon className={'w-5 h-5 flex-shrink-0 text-yellow-400'} />
            )}
            {children}
        </div>
    );
};
