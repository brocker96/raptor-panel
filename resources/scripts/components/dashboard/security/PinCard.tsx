import React, { useState } from 'react';
import { LockClosedIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Badge, Callout } from '@/components/admin/ui/Feedback';
import { Select } from '@/components/admin/ui/Form';
import { Confirm } from '@/components/admin/ui/Overlay';
import { ago, useAction } from '@/components/admin/ui/hooks';
import SecretInput from '@/components/security/SecretInput';
import { deletePin, lockScreen, SecurityOverview, updatePin, updateSecurityPreferences } from '@/api/account/security';
import { setLocked } from '@/plugins/securityPrompts';
import { useStoreActions } from '@/state/hooks';
import { t } from '@/i18n';

const PinCard = ({ data, refresh }: { data: SecurityOverview; refresh: () => void }) => {
    const updateUser = useStoreActions((actions) => actions.user.updateUserData);
    const [editing, setEditing] = useState(false);
    const [pin, setPin] = useState('');
    const [repeat, setRepeat] = useState('');
    const [removing, setRemoving] = useState(false);

    const save = useAction(() => updatePin(pin), {
        success: data.pin.enabled ? t('PIN changed') : t('PIN set'),
        onSuccess: () => {
            setEditing(false);
            setPin('');
            setRepeat('');
            updateUser({ hasPin: true });
            refresh();
        },
    });
    const remove = useAction(deletePin, {
        success: t('PIN removed'),
        onSuccess: () => {
            setRemoving(false);
            updateUser({ hasPin: false });
            refresh();
        },
    });
    const lockAfter = useAction(
        (minutes: number | null) => updateSecurityPreferences({ screen_lock_minutes: minutes }),
        {
            success: t('Screen lock updated'),
            onSuccess: refresh,
        }
    );

    const { max, choices } = data.screenLock;
    const effective = (minutes: number | null) => (max ? Math.min(minutes ?? max, max) : minutes);
    const mismatch = repeat.length > 0 && repeat !== pin;

    return (
        <Card
            icon={LockClosedIcon}
            title={t('PIN and screen lock')}
            description={t(
                'A 4 to 8 digit PIN confirms everyday sensitive actions and unlocks the panel after the screen lock.'
            )}
            actions={
                <Badge tone={data.pin.enabled ? 'green' : 'gray'} dot>
                    {data.pin.enabled ? t('PIN set') : t('No PIN')}
                </Badge>
            }
        >
            <div className={'space-y-5'}>
                {data.pin.locked && (
                    <Callout tone={'yellow'}>
                        {t(
                            'Your PIN was entered wrong too many times. Confirm once with your password to use it again.'
                        )}
                    </Callout>
                )}

                {editing ? (
                    <form
                        className={'space-y-3'}
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (pin.length >= 4 && pin === repeat) save.run();
                        }}
                    >
                        <div className={'grid sm:grid-cols-2 gap-3'}>
                            <SecretInput
                                kind={'pin'}
                                value={pin}
                                onChange={setPin}
                                placeholder={t('New PIN')}
                                aria-label={t('New PIN')}
                                autoFocus
                            />
                            <SecretInput
                                kind={'pin'}
                                value={repeat}
                                onChange={setRepeat}
                                placeholder={t('Repeat PIN')}
                                aria-label={t('Repeat PIN')}
                                className={mismatch ? 'ring-rose-500/70' : undefined}
                            />
                        </div>
                        <p className={'text-xs ' + (save.errors.pin || mismatch ? 'text-rose-300' : 'text-gray-500')}>
                            {save.errors.pin ||
                                (mismatch
                                    ? t('The PINs do not match.')
                                    : t('Avoid repeated or consecutive digits such as 1111 or 1234.'))}
                        </p>
                        <div className={'flex justify-end gap-2'}>
                            <Button variant={'ghost'} size={'sm'} onClick={() => setEditing(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button
                                type={'submit'}
                                size={'sm'}
                                loading={save.loading}
                                disabled={pin.length < 4 || pin !== repeat}
                            >
                                {t('Save PIN')}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className={'flex flex-wrap items-center justify-between gap-3'}>
                        <p className={'text-sm text-gray-400 min-w-0'}>
                            {data.pin.enabled
                                ? t('Set {{date}}.', { date: ago(data.pin.setAt) })
                                : t('Without a PIN you confirm actions and unlock the panel with your password.')}
                        </p>
                        <div className={'flex gap-2'}>
                            {data.pin.enabled && (
                                <Button variant={'ghost'} size={'sm'} onClick={() => setRemoving(true)}>
                                    {t('Remove')}
                                </Button>
                            )}
                            <Button
                                size={'sm'}
                                variant={data.pin.enabled ? 'secondary' : 'primary'}
                                onClick={() => setEditing(true)}
                            >
                                {data.pin.enabled ? t('Change PIN') : t('Set a PIN')}
                            </Button>
                        </div>
                    </div>
                )}

                <div className={'border-t border-gray-800 pt-5 grid sm:grid-cols-[1fr_auto] gap-3 items-end'}>
                    <Select
                        label={t('Lock the panel after')}
                        value={data.screenLock.minutes ?? ''}
                        disabled={lockAfter.loading}
                        description={
                            max
                                ? t('Your administrator requires the panel to lock after at most {{count}} minutes.', {
                                      count: max,
                                  })
                                : t('The panel locks when you did not use it for this long, also in other tabs.')
                        }
                        onChange={(value) => {
                            const minutes = value === '' ? null : Number(value);
                            updateUser({ screenLockMinutes: effective(minutes) });
                            lockAfter.run(minutes);
                        }}
                        options={[
                            { value: '', label: max ? t('{{count}} minutes (required)', { count: max }) : t('Never') },
                            ...choices
                                .filter((minutes) => !max || minutes <= max)
                                .map((minutes) => ({
                                    value: minutes,
                                    label: t('{{count}} minutes', { count: minutes }),
                                })),
                        ]}
                    />
                    <Button
                        variant={'secondary'}
                        icon={LockClosedIcon}
                        onClick={() => {
                            setLocked(true);
                            lockScreen().catch(() => undefined);
                        }}
                    >
                        {t('Lock now')}
                    </Button>
                </div>
            </div>

            <Confirm
                open={removing}
                title={t('Remove your PIN?')}
                confirm={t('Remove')}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setRemoving(false)}
            >
                {t('Sensitive actions and the screen lock will ask for your password instead.')}
            </Confirm>
        </Card>
    );
};

export default PinCard;
