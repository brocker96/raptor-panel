import React from 'react';
import { format } from 'date-fns';
import { DesktopComputerIcon, DeviceMobileIcon, DeviceTabletIcon } from '@heroicons/react/outline';
import { t } from '@/i18n';

export const DeviceIcon = ({ type, className }: { type: string; className?: string }) => {
    const Icon = type === 'mobile' ? DeviceMobileIcon : type === 'tablet' ? DeviceTabletIcon : DesktopComputerIcon;

    return <Icon className={className} />;
};

export const deviceLabel = (device: { browser: string; os: string }) =>
    t('{{browser}} on {{os}}', {
        browser: device.browser === 'Unknown browser' ? t('Unknown browser') : device.browser,
        os: device.os === 'Unknown system' ? t('unknown system') : device.os,
    });

export const methodLabel = (method: string): string =>
    ({
        password: t('Password'),
        'two-factor': t('Password and two-step code'),
        passkey: t('Passkey'),
        recovery: t('Recovery code'),
        'trusted-device': t('Password on a trusted device'),
        'password-reset': t('Password reset'),
        remember: t('Restored session'),
        session: t('Existing session'),
    }[method] || method);

export const loginEventLabel = (event: string): { label: string; tone: 'green' | 'red' | 'yellow' | 'blue' } =>
    ({
        'auth:success': { label: t('Signed in'), tone: 'green' as const },
        'auth:passkey': { label: t('Signed in with a passkey'), tone: 'green' as const },
        'auth:fail': { label: t('Failed sign-in'), tone: 'red' as const },
        'auth:checkpoint': { label: t('Asked for a two-step code'), tone: 'blue' as const },
        'auth:account-locked': { label: t('Account locked'), tone: 'yellow' as const },
    }[event] || { label: event, tone: 'blue' as const });

export const formatDate = (value: string | null | undefined): string => (value ? format(new Date(value), 'PPp') : '—');
