import { ResourceOptions, ResourceResult, useResource } from '@/api/query';
import { ActivityLog, Transformers } from '@definitions/user';
import { AxiosError } from 'axios';
import http, { PaginatedResult, QueryBuilderParams, withQueryBuilderParams } from '@/api/http';
import { toPaginatedSet } from '@definitions/helpers';
import useFilteredObject from '@/plugins/useFilteredObject';
import { useServerSWRKey } from '@/plugins/useSWRKey';
import { ServerContext } from '@/state/server';

export type ActivityLogFilters = QueryBuilderParams<'ip' | 'event', 'timestamp'>;

const useActivityLogs = (
    filters?: ActivityLogFilters,
    options?: ResourceOptions<PaginatedResult<ActivityLog>>
): ResourceResult<PaginatedResult<ActivityLog>, AxiosError> => {
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const key = useServerSWRKey(['activity', useFilteredObject(filters || {})]);

    return useResource<PaginatedResult<ActivityLog>>(
        [key],
        async (signal) => {
            const { data } = await http.get(`/api/client/servers/${uuid}/activity`, {
                signal,
                params: {
                    ...withQueryBuilderParams(filters),
                    include: ['actor'],
                },
            });

            return toPaginatedSet(data, Transformers.toActivityLog);
        },
        { keepPrevious: true, ...options }
    );
};

export { useActivityLogs };
