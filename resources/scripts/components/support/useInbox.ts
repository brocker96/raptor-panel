import { useResource } from '@/api/query';
import { getInbox } from '@/api/support';
import { useStoreState } from '@/state/hooks';

/**
 * Ticket counters for the navigation badges. Polled once a minute, and only while the Panel has
 * support turned on.
 */
export default () => {
    const enabled = useStoreState((state) => !!state.settings.data?.support);
    const { data } = useResource(['support', 'inbox'], (signal) => getInbox(signal), {
        enabled,
        refetchInterval: 60_000,
    });

    return { enabled, tickets: data?.tickets ?? 0, staff: data?.staff_tickets ?? 0 };
};
