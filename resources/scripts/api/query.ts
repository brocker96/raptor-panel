import { useCallback, useRef } from 'react';
import { QueryClient, QueryKey, UseQueryOptions, keepPreviousData, useQuery } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for a short amount of time, navigating back and forth
            // between pages renders instantly from the cache instead of hitting the API again.
            staleTime: 15_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            // Client errors (permissions, missing resources, validation) will not succeed by
            // retrying, so only retry network failures and server errors.
            retry: (failureCount, error) => {
                if (isAxiosError(error) && error.response && error.response.status < 500) {
                    return false;
                }

                return failureCount < 2;
            },
        },
    },
});

type Updater<T> = T | ((current: T | undefined) => T | undefined);

/**
 * Updates the cached data of the query and optionally refetches it from the API. Calling it
 * without any arguments simply refetches the data.
 */
export type Mutate<T> = (data?: Updater<T>, revalidate?: boolean) => Promise<T | undefined>;

export interface ResourceOptions<T> {
    enabled?: boolean;
    /**
     * Data rendered while the real data is being fetched, for example data already known from
     * another request. Unlike initial data it is never written to the cache.
     */
    placeholderData?: T;
    /** Keep rendering the previous data while the data for a new key is loading. */
    keepPrevious?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    /** Polls the data at the given interval, polling pauses while the browser tab is hidden. */
    refetchInterval?: number;
}

export interface ResourceResult<T, E> {
    data: T | undefined;
    error: E | undefined;
    isLoading: boolean;
    isValidating: boolean;
    mutate: Mutate<T>;
}

/**
 * Thin wrapper around TanStack Query's `useQuery` that exposes the data, error and mutate API
 * used throughout the panel for optimistic updates.
 */
export function useResource<T, E = AxiosError>(
    key: QueryKey,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: ResourceOptions<T> = {}
): ResourceResult<T, E> {
    const { keepPrevious, placeholderData, ...rest } = options;

    const query = useQuery<T, E>({
        queryKey: key,
        // The signal is aborted when the query is cancelled (e.g. all observers unmounted or
        // cancelQueries called), fetchers pass it to axios so the HTTP request is aborted as well.
        queryFn: ({ signal }) => fetcher(signal),
        placeholderData: (keepPrevious ? keepPreviousData : placeholderData) as UseQueryOptions<
            T,
            E
        >['placeholderData'],
        ...rest,
    });

    // Keep the latest key and query around so that the returned mutate function can be stable
    // across renders, call sites frequently use it inside of effects and callbacks.
    const latest = useRef({ key, refetch: query.refetch });
    latest.current = { key, refetch: query.refetch };

    const mutate = useCallback<Mutate<T>>(async (data, revalidate = true) => {
        const { key, refetch } = latest.current;

        if (data !== undefined) {
            queryClient.setQueryData<T>(key, (current) =>
                typeof data === 'function' ? (data as (current: T | undefined) => T | undefined)(current) : data
            );
        }

        if (!revalidate) {
            return queryClient.getQueryData<T>(key);
        }

        return (await refetch()).data;
    }, []);

    return {
        data: query.data,
        error: query.error ?? undefined,
        isLoading: query.isLoading,
        isValidating: query.isFetching,
        mutate,
    };
}

/**
 * Returns a mutate function for a query without subscribing to it. Components that only update
 * a query (for example every row of a list) should use this so that mounting them does not
 * cause the data to be refetched.
 */
export function useResourceMutate<T>(key: QueryKey): Mutate<T> {
    const latest = useRef(key);
    latest.current = key;

    return useCallback<Mutate<T>>(async (data, revalidate = true) => {
        const key = latest.current;

        if (data !== undefined) {
            queryClient.setQueryData<T>(key, (current) =>
                typeof data === 'function' ? (data as (current: T | undefined) => T | undefined)(current) : data
            );
        }

        if (revalidate) {
            await queryClient.refetchQueries({ queryKey: key, exact: true });
        }

        return queryClient.getQueryData<T>(key);
    }, []);
}
