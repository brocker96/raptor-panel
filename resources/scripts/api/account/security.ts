import http from '@/api/http';

export type ConfirmMethod = 'passkey' | 'totp' | 'password' | 'pin';

interface Device {
    browser: string;
    os: string;
    type: 'desktop' | 'mobile' | 'tablet';
}

export interface SecuritySession extends Device {
    identifier: string;
    current: boolean;
    ip: string;
    method: string;
    remember: boolean;
    createdAt: string;
    lastActiveAt: string | null;
    expiresAt: string | null;
}

export interface TrustedDevice extends Device {
    id: number;
    ip: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
}

export interface Passkey {
    id: number;
    name: string;
    transports: string[];
    createdAt: string;
    lastUsedAt: string | null;
}

export interface LoginEvent extends Device {
    event: string;
    ip: string | null;
    timestamp: string;
}

export interface SecurityOverview {
    twoFactor: { enabled: boolean; recoveryCodes: number };
    pin: { enabled: boolean; setAt: string | null; locked: boolean };
    screenLock: { minutes: number | null; effective: number | null; max: number | null; choices: number[] };
    alerts: boolean;
    passkeys: Passkey[];
    sessions: SecuritySession[];
    trustedDevices: TrustedDevice[];
    logins: LoginEvent[];
    policy: {
        passkeys: boolean;
        trustedDeviceDays: number;
        confirmWindow: number;
        sessionDays: number;
        idleTimeout: number;
        twoFactorRequired: number;
    };
}

const device = (raw: any): Device => ({ browser: raw.browser, os: raw.os, type: raw.type });

export const getSecurityOverview = async (): Promise<SecurityOverview> => {
    const { data } = await http.get('/api/client/account/security');

    return {
        twoFactor: { enabled: data.two_factor.enabled, recoveryCodes: data.two_factor.recovery_codes },
        pin: { enabled: data.pin.enabled, setAt: data.pin.set_at, locked: data.pin.locked },
        screenLock: data.screen_lock,
        alerts: data.alerts,
        passkeys: data.passkeys.map((key: any) => ({
            id: key.id,
            name: key.name,
            transports: key.transports,
            createdAt: key.created_at,
            lastUsedAt: key.last_used_at,
        })),
        sessions: data.sessions.map((session: any) => ({
            ...device(session),
            identifier: session.identifier,
            current: session.current,
            ip: session.ip,
            method: session.method,
            remember: session.remember,
            createdAt: session.created_at,
            lastActiveAt: session.last_active_at,
            expiresAt: session.expires_at,
        })),
        trustedDevices: data.trusted_devices.map((item: any) => ({
            ...device(item),
            id: item.id,
            ip: item.ip,
            createdAt: item.created_at,
            lastUsedAt: item.last_used_at,
            expiresAt: item.expires_at,
        })),
        logins: data.logins.map((item: any) => ({
            ...device(item),
            event: item.event,
            ip: item.ip,
            timestamp: item.timestamp,
        })),
        policy: {
            passkeys: data.policy.passkeys,
            trustedDeviceDays: data.policy.trusted_device_days,
            confirmWindow: data.policy.confirm_window,
            sessionDays: data.policy.session_days,
            idleTimeout: data.policy.idle_timeout,
            twoFactorRequired: data.policy.two_factor_required,
        },
    };
};

export const confirmIdentity = (method: ConfirmMethod, value: string | null, credential?: Record<string, unknown>) =>
    http.post('/api/client/account/security/confirm', { method, value, credential });

export const getConfirmPasskeyOptions = async () =>
    (await http.post('/api/client/account/security/confirm/passkey')).data.data;

export const lockScreen = () => http.post('/api/client/account/security/lock');

export const unlockScreen = (method: 'pin' | 'password', value: string) =>
    http.post('/api/client/account/security/unlock', { method, value });

export const updatePin = (pin: string) => http.put('/api/client/account/security/pin', { pin });

export const deletePin = () => http.delete('/api/client/account/security/pin');

export const updateSecurityPreferences = (data: { screen_lock_minutes?: number | null; security_alerts?: boolean }) =>
    http.put('/api/client/account/security/preferences', data);

export const revokeSession = (identifier: string) => http.delete(`/api/client/account/security/sessions/${identifier}`);

export const revokeOtherSessions = async (): Promise<number> =>
    (await http.post('/api/client/account/security/sessions/revoke-others')).data.revoked;

export const forgetTrustedDevice = (id: number) => http.delete(`/api/client/account/security/trusted-devices/${id}`);

export const forgetTrustedDevices = () => http.delete('/api/client/account/security/trusted-devices');

export const getPasskeyRegistrationOptions = async () =>
    (await http.post('/api/client/account/security/passkeys/options')).data.data;

export const storePasskey = (name: string, credential: Record<string, unknown>) =>
    http.post('/api/client/account/security/passkeys', { name, credential });

export const renamePasskey = (id: number, name: string) =>
    http.patch(`/api/client/account/security/passkeys/${id}`, { name });

export const deletePasskey = (id: number) => http.delete(`/api/client/account/security/passkeys/${id}`);

export const regenerateRecoveryCodes = async (): Promise<string[]> =>
    (await http.post('/api/client/account/security/recovery-codes')).data.tokens;
