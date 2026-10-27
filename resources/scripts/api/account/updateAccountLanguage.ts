import http from '@/api/http';

/** Sets the interface language of the account, null follows the default language of the Panel. */
export default (language: string | null): Promise<void> =>
    http.put('/api/client/account/language', { language }).then(() => undefined);
