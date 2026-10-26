import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import { cleanDirectoryPath } from '@/helpers';
import { ServerContext } from '@/state/server';
import { useResource, useResourceMutate } from '@/api/query';

export const getDirectorySwrKey = (uuid: string, directory: string): string => `${uuid}:files:${directory}`;

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    return useResource<FileObject[]>(
        [getDirectorySwrKey(uuid, directory)],
        (signal) => loadDirectory(uuid, cleanDirectoryPath(directory), signal),
        // Directory listings change frequently (uploads, the server writing files), so they are
        // always refreshed when a directory is opened while still rendering the cached listing.
        { staleTime: 0 }
    );
};

/**
 * Returns the mutate function for the directory currently being viewed, without subscribing to
 * (and therefore refetching) the directory listing.
 */
export const useFileManagerMutate = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    return useResourceMutate<FileObject[]>([getDirectorySwrKey(uuid, directory)]);
};
