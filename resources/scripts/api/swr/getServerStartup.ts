import useSWR, { SWRConfiguration } from 'swr';
import http, { FractalResponseList } from '@/api/http';
import { rawDataToServerEggVariable } from '@/api/transformers';
import { ServerEggVariable } from '@/api/server/types';

interface Response {
    invocation: string;
    variables: ServerEggVariable[];
    dockerImages: Record<string, string>;
}

export default (uuid: string, initialData?: Response | null, config?: SWRConfiguration<Response>) =>
    useSWR(
        [uuid, '/startup'],
        async (): Promise<Response> => {
            const { data } = await http.get(`/api/client/servers/${uuid}/startup`);

            const variables = ((data as FractalResponseList).data || []).map(rawDataToServerEggVariable);

            return {
                variables,
                invocation: data.meta.startup_command,
                dockerImages: data.meta.docker_images || {},
            };
        },
        {
            fallbackData: initialData || undefined,
            // When initial data is provided there is no need to immediately hit the API again.
            revalidateOnMount: !initialData,
            errorRetryCount: 3,
            ...(config || {}),
        }
    );
