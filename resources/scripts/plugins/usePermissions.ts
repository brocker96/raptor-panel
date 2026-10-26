import { ServerContext } from '@/state/server';
import { useDeepCompareMemo } from '@/plugins/useDeepCompareMemo';

/**
 * Checks the given permissions against the permissions a user has on a server. A permission
 * ending in ".*" matches any permission in that namespace, e.g. "file.*" matches "file.read".
 */
export const checkPermissions = (userPermissions: string[], action: string | string[]): boolean[] => {
    if (userPermissions[0] === '*') {
        return Array(Array.isArray(action) ? action.length : 1).fill(true);
    }

    return (Array.isArray(action) ? action : [action]).map(
        (permission) =>
            (permission.endsWith('.*') &&
                userPermissions.filter((p) => p.startsWith(permission.split('.')[0])).length > 0) ||
            userPermissions.indexOf(permission) >= 0
    );
};

export const usePermissions = (action: string | string[]): boolean[] => {
    const userPermissions = ServerContext.useStoreState((state) => state.server.permissions);

    return useDeepCompareMemo(() => checkPermissions(userPermissions, action), [action, userPermissions]);
};
