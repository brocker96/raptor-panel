import { ResourceOptions, ResourceResult, useResource } from '@/api/query';
import { ActivityLog, Transformers } from '@definitions/user';
import { AxiosError } from 'axios';
import http, { PaginatedResult, QueryBuilderParams, withQueryBuilderParams } from '@/api/http';
import { toPaginatedSet } from '@definitions/helpers';
import useFilteredObject from '@/plugins/useFilteredObject';
import { useUserSWRKey } from '@/plugins/useSWRKey';

export type ActivityLogFilters = QueryBuilderParams<'ip' | 'event', 'timestamp'>;

const useActivityLogs = (
    filters?: ActivityLogFilters,
    options?: ResourceOptions<PaginatedResult<ActivityLog>>
): ResourceResult<PaginatedResult<ActivityLog>, AxiosError> => {
    const key = useUserSWRKey(['account', 'activity', JSON.stringify(useFilteredObject(filters || {}))]);

    return useResource<PaginatedResult<ActivityLog>>(
        [key],
        async (signal) => {
            const { data } = await http.get('/api/client/account/activity', {
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
