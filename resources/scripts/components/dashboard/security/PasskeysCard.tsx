import React, { useState } from 'react';
import { FingerPrintIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { TextInput } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import { ago, useAction } from '@/components/admin/ui/hooks';
import {
    deletePasskey,
    getPasskeyRegistrationOptions,
    Passkey,
    renamePasskey,
    SecurityOverview,
    storePasskey,
} from '@/api/account/security';
import { createPasskey, isPasskeyCancelled, passkeysSupported } from '@/lib/webauthn';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const defaultName = () => {
    const agent = navigator.userAgent;
    if (/iPhone|iPad/.test(agent)) return 'iPhone';
    if (/Android/.test(agent)) return 'Android';
    if (/Mac OS X/.test(agent)) return 'Mac';
    if (/Windows/.test(agent)) return 'Windows Hello';

    return t('My passkey');
};

const PasskeysCard = ({ data, refresh }: { data: SecurityOverview; refresh: () => void }) => {
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [renaming, setRenaming] = useState<Passkey | null>(null);
    const [removing, setRemoving] = useState<Passkey | null>(null);
    const supported = passkeysSupported();

    const rename = useAction((key: Passkey, value: string) => renamePasskey(key.id, value), {
        success: t('Passkey renamed'),
        onSuccess: () => {
            setRenaming(null);
            refresh();
        },
    });
    const remove = useAction((key: Passkey) => deletePasskey(key.id), {
        success: t('Passkey removed'),
        onSuccess: () => {
            setRemoving(null);
            refresh();
        },
    });

    const register = async () => {
        setBusy(true);
        try {
            const credential = await createPasskey(await getPasskeyRegistrationOptions());
            await storePasskey(name.trim() || defaultName(), credential);
            toast.success(t('Passkey added'), t('You can now sign in with it instead of your password.'));
            setAdding(false);
            setName('');
            refresh();
        } catch (error) {
            if (!isPasskeyCancelled(error)) {
                toast.error(t('The passkey could not be added'), httpErrorToHuman(error));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card
            icon={FingerPrintIcon}
            title={t('Passkeys')}
            description={t(
                'Sign in with your fingerprint, face, device PIN or a security key instead of a password. Passkeys cannot be phished or leaked.'
            )}
            actions={
                supported && !adding ? (
                    <Button size={'sm'} icon={PlusIcon} onClick={() => setAdding(true)}>
                        {t('Add')}
                    </Button>
                ) : undefined
            }
        >
            {!supported && (
                <Callout tone={'yellow'}>
                    {t('This browser does not support passkeys, or the panel is not opened over HTTPS.')}
                </Callout>
            )}

            {adding && (
                <form
                    className={'mb-4 rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 p-3 space-y-3'}
                    onSubmit={(e) => {
                        e.preventDefault();
                        register();
                    }}
                >
                    <TextInput
                        label={t('Name')}
                        value={name}
                        maxLength={64}
                        placeholder={defaultName()}
                        onChange={setName}
                        autoFocus
                        description={t('Helps you recognise the passkey later, for example "Work laptop".')}
                    />
                    <div className={'flex justify-end gap-2'}>
                        <Button variant={'ghost'} size={'sm'} onClick={() => setAdding(false)} disabled={busy}>
                            {t('Cancel')}
                        </Button>
                        <Button type={'submit'} size={'sm'} icon={FingerPrintIcon} loading={busy}>
                            {t('Create passkey')}
                        </Button>
                    </div>
                </form>
            )}

            {data.passkeys.length === 0 ? (
                !adding && <p className={'text-sm text-gray-500'}>{t('No passkeys yet.')}</p>
            ) : (
                <ul className={'divide-y divide-gray-800 -my-2'}>
                    {data.passkeys.map((key) => (
                        <li key={key.id} className={'flex items-center gap-3 py-2.5'}>
                            <span
                                className={
                                    'grid place-items-center w-9 h-9 flex-shrink-0 rounded-lg bg-gray-800 text-gray-300'
                                }
                            >
                                <FingerPrintIcon className={'w-4 h-4'} />
                            </span>
                            <div className={'min-w-0 flex-1'}>
                                {renaming?.id === key.id ? (
                                    <form
                                        className={'flex gap-2'}
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const value = (new FormData(e.currentTarget).get('name') as string) || '';
                                            if (value.trim()) rename.run(key, value.trim());
                                        }}
                                    >
                                        <input
                                            name={'name'}
                                            defaultValue={key.name}
                                            maxLength={64}
                                            autoFocus
                                            className={
                                                'flex-1 min-w-0 h-8 px-2 rounded-md bg-gray-950/60 border-0 ring-1 ring-inset ring-gray-700 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-raptor-500'
                                            }
                                        />
                                        <Button type={'submit'} size={'sm'} loading={rename.loading}>
                                            {t('Save')}
                                        </Button>
                                    </form>
                                ) : (
                                    <>
                                        <p className={'text-sm text-gray-100 break-words'}>{key.name}</p>
                                        <p className={'text-xs text-gray-500'}>
                                            {t('Added {{date}}', { date: ago(key.createdAt) })}
                                            {' · '}
                                            {key.lastUsedAt
                                                ? t('last used {{date}}', { date: ago(key.lastUsedAt) })
                                                : t('never used')}
                                        </p>
                                    </>
                                )}
                            </div>
                            {renaming?.id !== key.id && (
                                <div className={'flex flex-shrink-0 gap-1'}>
                                    <Button
                                        variant={'ghost'}
                                        size={'sm'}
                                        icon={PencilIcon}
                                        aria-label={t('Rename')}
                                        title={t('Rename')}
                                        onClick={() => setRenaming(key)}
                                    />
                                    <Button
                                        variant={'ghost'}
                                        size={'sm'}
                                        icon={TrashIcon}
                                        aria-label={t('Remove')}
                                        title={t('Remove')}
                                        onClick={() => setRemoving(key)}
                                    />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <Confirm
                open={!!removing}
                title={t('Remove passkey?')}
                confirm={t('Remove')}
                loading={remove.loading}
                onConfirm={() => removing && remove.run(removing)}
                onClose={() => setRemoving(null)}
            >
                {t(
                    '"{{name}}" can no longer be used to sign in. Remove it from the device or password manager as well.',
                    {
                        name: removing?.name,
                    }
                )}
            </Confirm>
        </Card>
    );
};

export default PasskeysCard;
