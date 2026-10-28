import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { isBackgroundRequest, requestConfirmation, setLocked, waitForUnlock } from '@/plugins/securityPrompts';
import { store } from '@/state';

const http: AxiosInstance = axios.create({
    withCredentials: true,
    timeout: 20000,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

http.interceptors.request.use((req) => {
    if (!req.url?.endsWith('/resources')) {
        store.getActions().progress.startContinuous();
    }

    if (req.url?.endsWith('/resources') || isBackgroundRequest()) {
        req.headers.set('X-Raptor-Background', '1');
    }

    return req;
});

type RetryConfig = InternalAxiosRequestConfig & { _confirmed?: boolean; _unlocked?: boolean };

http.interceptors.response.use(
    (resp) => {
        if (!resp.request?.url?.endsWith('/resources')) {
            store.getActions().progress.setComplete();
        }

        return resp;
    },
    async (error: AxiosError) => {
        store.getActions().progress.setComplete();

        const config = error.config as RetryConfig | undefined;
        const detail = (error.response?.data as any)?.errors?.[0];

        // Sensitive actions: ask the user to confirm it is them and send the request again.
        if (config && detail?.code === 'SecurityConfirmationRequired' && !config._confirmed) {
            const confirmed = await requestConfirmation(detail.meta?.methods || ['password'], !!detail.meta?.strong);
            if (confirmed) {
                return http.request({ ...config, _confirmed: true } as RetryConfig);
            }
        }

        // The screen locked while the request was made: wait for the unlock and replay it.
        if (config && detail?.code === 'ScreenLocked' && !config._unlocked) {
            setLocked(true);
            await waitForUnlock();

            return http.request({ ...config, _unlocked: true } as RetryConfig);
        }

        // The session was ended from another device or timed out.
        if (detail?.code === 'SessionEnded' && !window.location.pathname.startsWith('/auth')) {
            window.location.href = '/auth/login';
        }

        throw error;
    }
);

export default http;

/**
 * Converts an error into a human readable response. Mostly just a generic helper to
 * make sure we display the message from the server back to the user if we can.
 */
export function httpErrorToHuman(error: any): string {
    if (error.response && error.response.data) {
        let { data } = error.response;

        // Some non-JSON requests can still return the error as a JSON block. In those cases, attempt
        // to parse it into JSON so we can display an actual error.
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // do nothing, bad json
            }
        }

        if (data.errors && data.errors[0] && data.errors[0].detail) {
            return data.errors[0].detail;
        }

        // Errors from wings directory, mostly just for file uploads.
        if (data.error && typeof data.error === 'string') {
            return data.error;
        }
    }

    return error.message;
}

export interface FractalResponseData {
    object: string;
    attributes: {
        [k: string]: any;
        relationships?: Record<string, FractalResponseData | FractalResponseList | null | undefined>;
    };
}

export interface FractalResponseList {
    object: 'list';
    data: FractalResponseData[];
}

export interface FractalPaginatedResponse extends FractalResponseList {
    meta: {
        pagination: {
            total: number;
            count: number;

            per_page: number;
            current_page: number;
            total_pages: number;
        };
    };
}

export interface PaginatedResult<T> {
    items: T[];
    pagination: PaginationDataSet;
}

export interface PaginationDataSet {
    total: number;
    count: number;
    perPage: number;
    currentPage: number;
    totalPages: number;
}

export function getPaginationSet(data: any): PaginationDataSet {
    return {
        total: data.total,
        count: data.count,
        perPage: data.per_page,
        currentPage: data.current_page,
        totalPages: data.total_pages,
    };
}

type QueryBuilderFilterValue = string | number | boolean | null;

export interface QueryBuilderParams<FilterKeys extends string = string, SortKeys extends string = string> {
    page?: number;
    filters?: {
        [K in FilterKeys]?: QueryBuilderFilterValue | Readonly<QueryBuilderFilterValue[]>;
    };
    sorts?: {
        [K in SortKeys]?: -1 | 0 | 1 | 'asc' | 'desc' | null;
    };
}

/**
 * Helper function that parses a data object provided and builds query parameters
 * for the Laravel Query Builder package automatically. This will apply sorts and
 * filters deterministically based on the provided values.
 */
export const withQueryBuilderParams = (data?: QueryBuilderParams): Record<string, unknown> => {
    if (!data) return {};

    const filters = Object.keys(data.filters || {}).reduce((obj, key) => {
        const value = data.filters?.[key];

        return !value || value === '' ? obj : { ...obj, [`filter[${key}]`]: value };
    }, {} as NonNullable<QueryBuilderParams['filters']>);

    const sorts = Object.keys(data.sorts || {}).reduce((arr, key) => {
        const value = data.sorts?.[key];
        if (!value || !['asc', 'desc', 1, -1].includes(value)) {
            return arr;
        }

        return [...arr, (value === -1 || value === 'desc' ? '-' : '') + key];
    }, [] as string[]);

    return {
        ...filters,
        sort: !sorts.length ? undefined : sorts.join(','),
        page: data.page,
    };
};
