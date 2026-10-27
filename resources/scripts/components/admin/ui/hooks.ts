import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { queryClient } from '@/api/query';
import { fieldErrors } from '@/api/admin';
import { toast } from '@/components/admin/ui/Toast';

/**
 * Keeps the page, search text and filters of a list in the URL so that reloading the page or
 * sharing the link shows the same results.
 */
export const useListParams = <F extends string>(filters: F[] = []) => {
    const [params, setParams] = useSearchParams();

    const page = Math.max(1, Number(params.get('page') || 1));
    const search = params.get('search') || '';
    const values = Object.fromEntries(filters.map((key) => [key, params.get(key) || ''])) as Record<F, string>;

    const set = useCallback(
        (changes: Record<string, string | number | undefined>) => {
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    Object.entries(changes).forEach(([key, value]) => {
                        value === undefined || value === '' ? next.delete(key) : next.set(key, String(value));
                    });
                    // Changing what is being looked at always starts from the first page again.
                    if (!('page' in changes)) next.delete('page');

                    return next;
                },
                { replace: true }
            );
        },
        [setParams]
    );

    return {
        page,
        search,
        filters: values,
        setPage: (value: number) => set({ page: value }),
        setSearch: (value: string) => set({ search: value }),
        setFilter: (key: F, value: string) => set({ [key]: value }),
        query: {
            page,
            search: search || undefined,
            ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
        },
    };
};

interface ActionOptions<T> {
    success?: string | ((result: T) => string);
    /** Query keys to refetch once the action succeeded. */
    invalidate?: unknown[][];
    onSuccess?: (result: T) => void;
}

/**
 * Wraps an API call with a loading state, success and error toasts, validation errors for the
 * form and cache invalidation.
 */
export const useAction = <A extends unknown[], T>(fn: (...args: A) => Promise<T>, options: ActionOptions<T> = {}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const run = async (...args: A): Promise<T | undefined> => {
        setLoading(true);
        setErrors({});

        try {
            const result = await fn(...args);
            await Promise.all(
                (options.invalidate || []).map((key) => queryClient.invalidateQueries({ queryKey: key }))
            );

            const message = typeof options.success === 'function' ? options.success(result) : options.success;
            if (message) toast.success(message);
            options.onSuccess?.(result);

            return result;
        } catch (error) {
            const fields = fieldErrors(error);
            setErrors(fields);
            toast.fromError(
                error,
                Object.keys(fields).length ? 'Please check the highlighted fields' : 'Action failed'
            );

            return undefined;
        } finally {
            setLoading(false);
        }
    };

    return { run, loading, errors, setErrors };
};

export const formatMb = (mb: number | null | undefined): string => {
    if (mb === null || mb === undefined) return '—';
    if (mb === 0) return 'Unlimited';
    if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(1)} TiB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GiB`;

    return `${mb} MiB`;
};

export const formatBytes = (bytes: number): string => {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
};

export const ago = (date: string | null | undefined): string => {
    if (!date) return 'never';

    return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
};
