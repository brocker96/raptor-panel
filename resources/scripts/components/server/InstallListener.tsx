import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import { queryClient } from '@/api/query';
import { getDirectorySwrKey } from '@/plugins/useFileManagerSwr';

const InstallListener = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);

    useWebsocketEvent(SocketEvent.BACKUP_RESTORE_COMPLETED, () => {
        // The restored files replace everything on the server, so drop every cached directory listing.
        const prefix = getDirectorySwrKey(uuid, '');
        queryClient.resetQueries({ predicate: (query) => String(query.queryKey[0]).startsWith(prefix) });
        setServerFromState((s) => ({ ...s, status: null }));
    });

    // Listen for the installation completion event and then fire off a request to fetch the updated
    // server information. This allows the server to automatically become available to the user if they
    // just sit on the page.
    useWebsocketEvent(SocketEvent.INSTALL_COMPLETED, () => {
        getServer(uuid).catch((error) => console.error(error));
    });

    // When we see the install started event immediately update the state to indicate such so that the
    // screens automatically update.
    useWebsocketEvent(SocketEvent.INSTALL_STARTED, () => {
        setServerFromState((s) => ({ ...s, status: 'installing' }));
    });

    return null;
};

export default InstallListener;
