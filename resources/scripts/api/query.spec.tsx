import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, useResource, useResourceMutate } from '@/api/query';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('@/api/query.ts', () => {
    afterEach(() => queryClient.clear());

    it('fetches and exposes data', async () => {
        const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
        const { result } = renderHook(() => useResource(['numbers'], fetcher), { wrapper });

        await waitFor(() => expect(result.current.data).toEqual([1, 2, 3]));
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('applies optimistic updates without refetching when revalidate is false', async () => {
        const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
        const { result } = renderHook(() => useResource<number[]>(['numbers'], fetcher), { wrapper });
        await waitFor(() => expect(result.current.data).toBeDefined());

        await act(() => result.current.mutate((data) => data?.filter((n) => n !== 2), false));

        await waitFor(() => expect(result.current.data).toEqual([1, 3]));
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('refetches when mutate is called without arguments', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce([1]).mockResolvedValueOnce([1, 2]);
        const { result } = renderHook(() => useResource(['numbers'], fetcher), { wrapper });
        await waitFor(() => expect(result.current.data).toEqual([1]));

        await act(async () => {
            expect(await result.current.mutate()).toEqual([1, 2]);
        });

        await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    });

    it('keeps the mutate function stable between renders', async () => {
        const { result, rerender } = renderHook(() => useResource(['numbers'], () => Promise.resolve([1])), {
            wrapper,
        });
        const first = result.current.mutate;
        rerender();

        expect(result.current.mutate).toBe(first);
    });

    it('renders placeholder data while loading without caching it', async () => {
        let resolve: (value: number[]) => void = () => undefined;
        const fetcher = () => new Promise<number[]>((r) => (resolve = r));
        const { result } = renderHook(() => useResource(['numbers'], fetcher, { placeholderData: [9] }), { wrapper });

        expect(result.current.data).toEqual([9]);
        expect(queryClient.getQueryData(['numbers'])).toBeUndefined();

        act(() => resolve([1]));
        await waitFor(() => expect(result.current.data).toEqual([1]));
    });

    it('updates a query from a component that is not subscribed to it', async () => {
        const fetcher = vi.fn().mockResolvedValue([1, 2]);
        const { result } = renderHook(
            () => ({
                query: useResource<number[]>(['numbers'], fetcher),
                mutate: useResourceMutate<number[]>(['numbers']),
            }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.query.data).toEqual([1, 2]));

        await act(() => result.current.mutate((data) => [...(data || []), 3], false));

        await waitFor(() => expect(result.current.query.data).toEqual([1, 2, 3]));
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
