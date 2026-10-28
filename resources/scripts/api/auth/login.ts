import http from '@/api/http';

export interface LoginResponse {
    complete: boolean;
    intended?: string;
    confirmationToken?: string;
    canTrustDevice?: boolean;
    trustDays?: number;
}

export interface LoginData {
    username: string;
    password: string;
    recaptchaData?: string | null;
    remember?: boolean;
}

export default ({ username, password, recaptchaData, remember = true }: LoginData): Promise<LoginResponse> => {
    return new Promise((resolve, reject) => {
        http.get('/sanctum/csrf-cookie')
            .then(() =>
                http.post('/auth/login', {
                    user: username,
                    password,
                    remember,
                    'g-recaptcha-response': recaptchaData,
                })
            )
            .then((response) => {
                if (!(response.data instanceof Object)) {
                    return reject(new Error('An error occurred while processing the login request.'));
                }

                return resolve({
                    complete: response.data.data.complete,
                    intended: response.data.data.intended || undefined,
                    confirmationToken: response.data.data.confirmation_token || undefined,
                    canTrustDevice: !!response.data.data.can_trust_device,
                    trustDays: response.data.data.trust_days || undefined,
                });
            })
            .catch(reject);
    });
};

/**
 * Passwordless sign in: the browser signs a challenge with a passkey of this site.
 */
export const loginWithPasskey = async (
    getCredential: (options: unknown) => Promise<Record<string, unknown>>,
    remember = true
): Promise<LoginResponse> => {
    await http.get('/sanctum/csrf-cookie');
    const { data: options } = await http.post('/auth/login/passkey/options');
    const credential = await getCredential(options.data);
    const { data } = await http.post('/auth/login/passkey', { credential, remember });

    return { complete: data.data.complete, intended: data.data.intended || undefined };
};
