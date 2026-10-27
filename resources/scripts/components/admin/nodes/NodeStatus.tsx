import React from 'react';
import { useResource } from '@/api/query';
import { getNodeSystem } from '@/api/admin';
import { Badge } from '@/components/admin/ui/Feedback';
import { t } from '@/i18n';

/** Live status of a node, asked from Wings and refreshed in the background. */
export const useNodeStatus = (id: number, enabled = true) =>
    useResource(['admin', 'nodes', id, 'system'], (signal) => getNodeSystem(id, signal), {
        enabled,
        refetchInterval: 15_000,
        staleTime: 10_000,
    });

export default ({ id }: { id: number }) => {
    const { data } = useNodeStatus(id);

    if (!data) {
        return <Badge>{t('Checking…')}</Badge>;
    }

    return data.online ? (
        <Badge tone={'green'} dot>
            {t('Online')}
            {data.latency !== undefined ? t(' · {{latency}} ms', { latency: data.latency }) : ''}
        </Badge>
    ) : (
        <span title={data.error}>
            <Badge tone={'red'} dot>
                {t('Offline')}
            </Badge>
        </span>
    );
};
