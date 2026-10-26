import React from 'react';
import classNames from 'classnames';

export type PowerStatus = 'running' | 'starting' | 'stopping' | 'offline' | string | null | undefined;

export const statusLabel = (status: PowerStatus): string => {
    switch (status) {
        case 'running':
            return 'Online';
        case 'starting':
            return 'Starting';
        case 'stopping':
            return 'Stopping';
        case 'offline':
            return 'Offline';
        default:
            return 'Unknown';
    }
};

/** A small colored dot representing the power state of a server. */
export default ({ status, className }: { status: PowerStatus; className?: string }) => (
    <span
        title={statusLabel(status)}
        className={classNames(
            'inline-block w-2.5 h-2.5 flex-shrink-0 rounded-full',
            {
                'bg-raptor-500 animate-pulse-ring': status === 'running',
                'bg-yellow-400 animate-pulse': status === 'starting' || status === 'stopping',
                'bg-red-500': status === 'offline',
                'bg-gray-500': !status,
            },
            className
        )}
    />
);
