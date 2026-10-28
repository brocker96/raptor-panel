import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { FingerPrintIcon, LockClosedIcon, LogoutIcon, ShieldCheckIcon } from '@heroicons/react/outline';
import Button from '@/components/admin/ui/Button';
import { spring } from '@/components/admin/ui/motion';
import Avatar from '@/components/Avatar';
import SecretInput from '@/components/security/SecretInput';
import { useStoreState } from '@/state/hooks';
import { httpErrorToHuman } from '@/api/http';
import {
    ConfirmMethod,
    confirmIdentity,
    getConfirmPasskeyOptions,
    lockScreen,
    unlockScreen,
} from '@/api/account/security';
import {
    getConfirmation,
    isLocked,
    markInteraction,
    lastInteractionAt,
    setLocked,
    subscribe,
} from '@/plugins/securityPrompts';
import { getPasskey, isPasskeyCancelled, passkeysSupported } from '@/lib/webauthn';
import { t } from '@/i18n';

const methodLabels = (): Record<ConfirmMethod, string> => ({
    passkey: t('Passkey'),
    totp: t('Authenticator code'),
    password: t('Password'),
    pin: t('PIN'),
});

const useSecurityState = () => useSyncExternalStore(subscribe, () => `${isLocked()}:${getConfirmation() ? 'c' : ''}`);

const Shell = ({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) => (
    <div className={'fixed inset-0 z-[80] grid place-items-center p-4'}>
        <motion.div
            className={'absolute inset-0 bg-black/70 backdrop-blur-sm'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        />
        <motion.div
            role={'dialog'}
            aria-modal
            className={'relative w-full max-w-sm rounded-2xl bg-gray-900 ring-1 ring-gray-800 shadow-2xl p-5 sm:p-6'}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring}
        >
            {children}
        </motion.div>
    </div>
);

/**
 * Asks the user to prove it is them before a sensitive action. Opened by the HTTP client when
 * the API answers with "SecurityConfirmationRequired".
 */
const ConfirmIdentityDialog = () => {
    useSecurityState();
    const request = getConfirmation();
    const methods = (request?.methods || []).filter((method) => method !== 'passkey' || passkeysSupported());
    const [method, setMethod] = useState<ConfirmMethod>('password');
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!request) return;

        setMethod(methods[0] || 'password');
        setValue('');
        setError('');
    }, [request]);

    useEffect(() => {
        setValue('');
        setError('');
        setTimeout(() => input.current?.focus(), 50);
    }, [method]);

    const close = (confirmed: boolean) => request?.resolve(confirmed);

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (loading) return;

        setLoading(true);
        setError('');
        try {
            if (method === 'passkey') {
                const credential = await getPasskey(await getConfirmPasskeyOptions());
                await confirmIdentity('passkey', null, credential);
            } else {
                await confirmIdentity(method, value);
            }
            close(true);
        } catch (err) {
            if (!isPasskeyCancelled(err)) setError(httpErrorToHuman(err));
            setValue('');
            input.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const labels = methodLabels();
    const ready =
        method === 'passkey' ||
        (method === 'pin' ? value.length >= 4 : method === 'totp' ? value.length === 6 : value.length > 0);

    return createPortal(
        <AnimatePresence>
            {request && (
                <Shell onClose={() => !loading && close(false)}>
                    <form onSubmit={submit}>
                        <span
                            className={
                                'grid place-items-center w-11 h-11 rounded-xl bg-raptor-500/10 text-raptor-400 ring-1 ring-inset ring-raptor-500/25'
                            }
                        >
                            <ShieldCheckIcon className={'w-5 h-5'} />
                        </span>
                        <h3 className={'mt-4 text-base font-semibold text-gray-50'}>{t('Confirm it is you')}</h3>
                        <p className={'mt-1 text-sm text-gray-400 leading-relaxed'}>
                            {request.strong
                                ? t(
                                      'This changes the security of your account. Confirm with your password, an authenticator code or a passkey.'
                                  )
                                : t(
                                      'This is a sensitive action. You will not be asked again for the next few minutes.'
                                  )}
                        </p>

                        {methods.length > 1 && (
                            <div className={'mt-4 flex flex-wrap gap-1.5'} role={'tablist'}>
                                {methods.map((item) => (
                                    <button
                                        key={item}
                                        type={'button'}
                                        role={'tab'}
                                        aria-selected={method === item}
                                        onClick={() => setMethod(item)}
                                        className={classNames(
                                            'px-3 min-h-8 rounded-lg text-xs font-medium ring-1 ring-inset transition-colors',
                                            method === item
                                                ? 'bg-raptor-500/15 text-raptor-300 ring-raptor-500/40'
                                                : 'text-gray-400 ring-gray-800 hover:text-gray-200 hover:ring-gray-700'
                                        )}
                                    >
                                        {labels[item]}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className={'mt-4'}>
                            {method === 'passkey' ? (
                                <Button
                                    className={'w-full'}
                                    icon={FingerPrintIcon}
                                    loading={loading}
                                    onClick={() => submit()}
                                >
                                    {t('Use a passkey')}
                                </Button>
                            ) : (
                                <SecretInput
                                    ref={input}
                                    autoFocus
                                    kind={method === 'pin' ? 'pin' : method === 'totp' ? 'totp' : 'password'}
                                    value={value}
                                    onChange={setValue}
                                    placeholder={
                                        method === 'pin'
                                            ? t('Enter your PIN')
                                            : method === 'totp'
                                            ? t('6-digit code')
                                            : t('Your password')
                                    }
                                    aria-label={labels[method]}
                                />
                            )}
                            {error && <p className={'mt-2 text-xs text-rose-300'}>{error}</p>}
                        </div>

                        <div className={'mt-5 flex justify-end gap-2'}>
                            <Button variant={'ghost'} onClick={() => close(false)} disabled={loading}>
                                {t('Cancel')}
                            </Button>
                            {method !== 'passkey' && (
                                <Button type={'submit'} loading={loading} disabled={!ready}>
                                    {t('Confirm')}
                                </Button>
                            )}
                        </div>
                    </form>
                </Shell>
            )}
        </AnimatePresence>,
        document.body
    );
};

/**
 * Covers the whole panel while the session is locked. Unlocking needs the PIN, or the password
 * when no PIN is set (or the PIN was entered wrong too often).
 */
const LockScreen = ({ hasPin }: { hasPin: boolean }) => {
    useSecurityState();
    const locked = isLocked();
    const user = useStoreState((state) => state.user.data);
    const [method, setMethod] = useState<'pin' | 'password'>(hasPin ? 'pin' : 'password');
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!locked) return;
        setMethod(hasPin ? 'pin' : 'password');
        setValue('');
        setError('');
    }, [locked, hasPin]);

    useEffect(() => {
        if (!locked) return;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = overflow;
        };
    }, [locked]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !value) return;

        setLoading(true);
        setError('');
        try {
            await unlockScreen(method, value);
            markInteraction();
            setLocked(false);
        } catch (err) {
            setError(httpErrorToHuman(err));
            setValue('');
            input.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            {locked && (
                <motion.div
                    className={'fixed inset-0 z-[90] grid place-items-center p-4 bg-gray-950'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div
                        aria-hidden
                        className={
                            'absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(82_211_33/0.12),transparent_60%)]'
                        }
                    />
                    <motion.form
                        onSubmit={submit}
                        className={'relative w-full max-w-xs text-center'}
                        initial={{ y: 16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={spring}
                    >
                        <div className={'relative mx-auto w-20 h-20'}>
                            <div className={'w-20 h-20 rounded-full overflow-hidden ring-2 ring-gray-800'}>
                                <Avatar.User />
                            </div>
                            <span
                                className={
                                    'absolute -bottom-1 -right-1 grid place-items-center w-8 h-8 rounded-full bg-gray-900 ring-2 ring-gray-950 text-raptor-400'
                                }
                            >
                                <LockClosedIcon className={'w-4 h-4'} />
                            </span>
                        </div>
                        <h2 className={'mt-5 text-lg font-semibold text-gray-50 break-words'}>{user?.username}</h2>
                        <p className={'mt-1 text-sm text-gray-400'}>
                            {method === 'pin'
                                ? t('The panel is locked. Enter your PIN to continue.')
                                : t('The panel is locked. Enter your password to continue.')}
                        </p>
                        <SecretInput
                            ref={input}
                            autoFocus
                            kind={method}
                            value={value}
                            onChange={setValue}
                            className={'mt-6'}
                            placeholder={method === 'pin' ? t('PIN') : t('Password')}
                            aria-label={method === 'pin' ? t('PIN') : t('Password')}
                        />
                        {error && <p className={'mt-2 text-xs text-rose-300'}>{error}</p>}
                        <Button type={'submit'} className={'mt-4 w-full'} loading={loading} disabled={!value}>
                            {t('Unlock')}
                        </Button>
                        <div className={'mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs'}>
                            {hasPin && (
                                <button
                                    type={'button'}
                                    className={'text-gray-400 hover:text-gray-100'}
                                    onClick={() => {
                                        setMethod(method === 'pin' ? 'password' : 'pin');
                                        setValue('');
                                        setError('');
                                        setTimeout(() => input.current?.focus(), 30);
                                    }}
                                >
                                    {method === 'pin' ? t('Use password instead') : t('Use PIN instead')}
                                </button>
                            )}
                            <a
                                href={'/auth/logout'}
                                onClick={logout}
                                className={'inline-flex items-center gap-1 text-gray-400 hover:text-rose-300'}
                            >
                                <LogoutIcon className={'w-3.5 h-3.5'} />
                                {t('Sign out')}
                            </a>
                        </div>
                    </motion.form>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

const logout = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];
    fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'X-XSRF-TOKEN': token ? decodeURIComponent(token) : '',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
    }).finally(() => (window.location.href = '/auth/login'));
};

/**
 * Locks the panel after the configured minutes without any interaction. Activity in another tab
 * counts as well, and locking or unlocking applies to every open tab.
 */
const useIdleLock = (minutes: number | null) => {
    useEffect(() => {
        let lastShared = 0;
        const onActivity = () => {
            markInteraction();
            if (Date.now() - lastShared > 5000) {
                lastShared = Date.now();
                try {
                    localStorage.setItem('raptor:activity', String(lastShared));
                } catch {
                    // ignore
                }
            }
        };

        const onStorage = (e: StorageEvent) => {
            if (e.key === 'raptor:activity') markInteraction();
            if (e.key === 'raptor:screen-lock' && e.newValue) {
                try {
                    setLocked(!!JSON.parse(e.newValue).locked, false);
                } catch {
                    // ignore
                }
            }
        };

        const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
        events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
        window.addEventListener('storage', onStorage);

        const timer = minutes
            ? setInterval(() => {
                  if (!isLocked() && Date.now() - lastInteractionAt() > minutes * 60_000) {
                      setLocked(true);
                      lockScreen().catch(() => undefined);
                  }
              }, 10_000)
            : null;

        return () => {
            events.forEach((event) => window.removeEventListener(event, onActivity));
            window.removeEventListener('storage', onStorage);
            if (timer) clearInterval(timer);
        };
    }, [minutes]);
};

const SecurityPrompts = () => {
    const user = useStoreState((state) => state.user.data);
    useIdleLock(user ? user.screenLockMinutes ?? null : null);

    if (!user) return null;

    return (
        <>
            <ConfirmIdentityDialog />
            <LockScreen hasPin={!!user.hasPin} />
        </>
    );
};

export default SecurityPrompts;
