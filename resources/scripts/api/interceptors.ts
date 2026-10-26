import http from '@/api/http';
import { AxiosError } from 'axios';
import { navigate } from '@/components/history';

export const setupInterceptors = () => {
    http.interceptors.response.use(
        (resp) => resp,
        (error: AxiosError) => {
            if (error.response?.status === 400) {
                if (
                    (error.response?.data as Record<string, any> | undefined)?.errors?.[0]?.code ===
                    'TwoFactorAuthRequiredException'
                ) {
                    if (!window.location.pathname.startsWith('/account')) {
                        navigate('/account', { replace: true, state: { twoFactorRedirect: true } });
                    }
                }
            }
            throw error;
        }
    );
};
