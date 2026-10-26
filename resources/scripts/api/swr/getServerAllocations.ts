import { ServerContext } from '@/state/server';
import http from '@/api/http';
import { rawDataToServerAllocation } from '@/api/transformers';
import { Allocation } from '@/api/server/getServer';
import { useResource } from '@/api/query';

export default (placeholderData?: Allocation[]) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    return useResource<Allocation[]>(
        ['server:allocations', uuid],
        async () => {
            const { data } = await http.get(`/api/client/servers/${uuid}/network/allocations`);

            return (data.data || []).map(rawDataToServerAllocation);
        },
        { placeholderData, refetchOnWindowFocus: false }
    );
};
