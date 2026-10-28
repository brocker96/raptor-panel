import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronDownIcon,
    ExclamationIcon,
    MailIcon,
    SearchIcon,
    ShieldCheckIcon,
    UserAddIcon,
} from '@heroicons/react/outline';
import { CheckIcon } from '@heroicons/react/solid';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { Callout } from '@/components/admin/ui/Feedback';
import { TextInput } from '@/components/admin/ui/Form';
import { toast } from '@/components/admin/ui/Toast';
import { useStoreState } from '@/state/hooks';
import { ServerContext } from '@/state/server';
import { Subuser } from '@/state/server/subusers';
import createOrUpdateSubuser from '@/api/server/users/createOrUpdateSubuser';
import { httpErrorToHuman } from '@/api/http';
import { expandGrants, matchPreset, permissionGroups, PermissionGroup, rolePresets } from './permissionCatalog';
import { t } from '@/i18n';

interface Props {
    open: boolean;
    onClose: () => void;
    /** Edits this subuser, a new one is invited when missing. */
    subuser?: Subuser;
    /** Opens the editor without the ability to change anything. */
    readOnly?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Check = ({ state }: { state: 'on' | 'off' | 'some' }) => (
    <span
        className={classNames(
            'grid place-items-center w-5 h-5 flex-shrink-0 rounded-md ring-1 ring-inset transition-colors',
            state === 'off' ? 'bg-gray-950/60 ring-gray-700' : 'bg-raptor-500 ring-raptor-400 text-gray-950'
        )}
    >
        {state === 'on' && <CheckIcon className={'w-3.5 h-3.5'} />}
        {state === 'some' && <span className={'w-2 h-0.5 rounded bg-gray-950'} />}
    </span>
);

const SubuserEditor = ({ open, onClose, subuser, readOnly }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const own = ServerContext.useStoreState((state) => state.server.permissions);
    const appendSubuser = ServerContext.useStoreActions((actions) => actions.subusers.appendSubuser);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const system = useStoreState((state) => state.permissions.data);

    const [step, setStep] = useState<'who' | 'access'>(subuser ? 'access' : 'who');
    const [email, setEmail] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Every permission the API knows, grouped with friendly names. Unknown permissions (added by
    // plugins or newer versions) are listed in their own group with the API description.
    const groups = useMemo<PermissionGroup[]>(() => {
        const known = permissionGroups();
        const listed = new Set(known.flatMap((group) => group.permissions.map((p) => p.key)));
        const available = new Set(
            Object.keys(system).flatMap((group) => Object.keys(system[group].keys).map((key) => `${group}.${key}`))
        );

        const result = known
            .map((group) => ({ ...group, permissions: group.permissions.filter((p) => available.has(p.key)) }))
            .filter((group) => group.permissions.length > 0);

        const extra = [...available].filter((key) => !listed.has(key) && !key.startsWith('websocket.'));
        if (extra.length) {
            result.push({
                key: 'other',
                label: t('Other'),
                description: t('Additional permissions.'),
                icon: ShieldCheckIcon,
                permissions: extra.map((key) => {
                    const [group, name] = key.split('.');

                    return { key, label: key, description: system[group]?.keys[name] || '' };
                }),
            });
        }

        return result;
    }, [system]);

    const all = useMemo(() => groups.flatMap((group) => group.permissions.map((p) => p.key)), [groups]);

    // Only permissions the current user holds can be handed out.
    const grantable = useMemo(
        () => (rootAdmin || own[0] === '*' ? all : all.filter((key) => own.includes(key))),
        [all, own, rootAdmin]
    );

    useEffect(() => {
        if (!open) return;

        setStep(subuser ? 'access' : 'who');
        setEmail(subuser?.email || '');
        setSelected((subuser?.permissions as string[] | undefined)?.filter((key) => key !== 'websocket.connect') || []);
        setSearch('');
        setCollapsed([]);
        setError('');
    }, [open, subuser]);

    const preset = matchPreset(selected, grantable);
    const editable = (key: string) => !readOnly && grantable.includes(key);
    const toggle = (key: string) =>
        editable(key) && setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

    const toggleGroup = (group: PermissionGroup) => {
        const keys = group.permissions.map((p) => p.key).filter(editable);
        const every = keys.every((key) => selected.includes(key));
        setSelected((s) => (every ? s.filter((key) => !keys.includes(key)) : [...new Set([...s, ...keys])]));
    };

    const query = search.trim().toLowerCase();
    const visible = groups
        .map((group) => ({
            ...group,
            permissions: group.permissions.filter(
                (p) =>
                    !query ||
                    [p.label, p.description, p.key, group.label].some((value) => value.toLowerCase().includes(query))
            ),
        }))
        .filter((group) => group.permissions.length > 0);

    const dangerous = selected.filter((key) =>
        groups.some((group) => group.permissions.some((p) => p.key === key && p.danger))
    ).length;

    const submit = async () => {
        if (saving || readOnly) return;

        setSaving(true);
        setError('');
        try {
            const result = await createOrUpdateSubuser(uuid, { email: email.trim(), permissions: selected }, subuser);
            appendSubuser(result);
            toast.success(
                subuser ? t('Permissions saved') : t('{{email}} was invited', { email: result.email }),
                subuser
                    ? undefined
                    : t('They get an e-mail and can sign in with their account, or set a password if they are new.')
            );
            onClose();
        } catch (err) {
            setError(httpErrorToHuman(err));
        } finally {
            setSaving(false);
        }
    };

    const validEmail = EMAIL.test(email.trim());

    const steps = !subuser && (
        <ol className={'flex items-center gap-2 text-xs'}>
            {[
                { key: 'who', label: t('Who') },
                { key: 'access', label: t('Access') },
            ].map((item, index) => {
                const active = step === item.key;
                const done = item.key === 'who' && step === 'access';

                return (
                    <li key={item.key} className={'flex items-center gap-2'}>
                        {index > 0 && <span className={'w-6 h-px bg-gray-700'} />}
                        <span
                            className={classNames(
                                'grid place-items-center w-5 h-5 rounded-full text-[0.65rem] font-bold',
                                active || done ? 'bg-raptor-500 text-gray-950' : 'bg-gray-800 text-gray-400'
                            )}
                        >
                            {done ? <CheckIcon className={'w-3 h-3'} /> : index + 1}
                        </span>
                        <span className={active ? 'text-gray-100 font-medium' : 'text-gray-500'}>{item.label}</span>
                    </li>
                );
            })}
        </ol>
    );

    const footer =
        step === 'who' ? (
            <>
                <Button variant={'ghost'} onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button icon={ArrowRightIcon} disabled={!validEmail} onClick={() => setStep('access')}>
                    {t('Choose access')}
                </Button>
            </>
        ) : (
            <>
                {!subuser && (
                    <Button variant={'ghost'} icon={ArrowLeftIcon} onClick={() => setStep('who')} disabled={saving}>
                        {t('Back')}
                    </Button>
                )}
                <span className={'hidden sm:block sm:mr-auto text-xs text-gray-500 order-first'}>
                    {t('{{count}} of {{total}} permissions', { count: selected.length, total: all.length })}
                </span>
                {readOnly ? (
                    <Button variant={'secondary'} onClick={onClose}>
                        {t('Close')}
                    </Button>
                ) : (
                    <Button
                        icon={subuser ? CheckIcon : UserAddIcon}
                        loading={saving}
                        disabled={selected.length === 0}
                        onClick={submit}
                    >
                        {subuser ? t('Save permissions') : t('Invite')}
                    </Button>
                )}
            </>
        );

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={saving}
            size={step === 'who' ? 'md' : 'xl'}
            icon={subuser ? ShieldCheckIcon : UserAddIcon}
            title={
                subuser
                    ? readOnly
                        ? t('Permissions of {{email}}', { email: subuser.email })
                        : t('Edit access of {{email}}', { email: subuser.email })
                    : t('Invite a user')
            }
            description={
                step === 'who'
                    ? t('Give someone access to this server without sharing your account.')
                    : t('Pick a role or choose exactly what they may do.')
            }
            toolbar={steps || undefined}
            footer={footer}
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{error}</Callout>
                </div>
            )}

            {step === 'who' ? (
                <form
                    className={'space-y-4'}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (validEmail) setStep('access');
                    }}
                >
                    <TextInput
                        label={t('E-mail address')}
                        type={'email'}
                        value={email}
                        onChange={setEmail}
                        placeholder={'friend@example.com'}
                        autoFocus
                        autoComplete={'off'}
                        description={t(
                            'If there is no account with this address yet, one is created and they get an e-mail to set a password.'
                        )}
                    />
                    <div className={'flex gap-3 rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 p-3'}>
                        <MailIcon className={'w-5 h-5 flex-shrink-0 text-gray-500'} />
                        <p className={'text-xs text-gray-400 leading-relaxed'}>
                            {t(
                                'They see this server on their dashboard right away. You can change or remove their access at any time.'
                            )}
                        </p>
                    </div>
                </form>
            ) : (
                <div className={'space-y-5'}>
                    {!readOnly && (
                        <section>
                            <p className={'text-2xs uppercase tracking-wider text-gray-500 mb-2'}>{t('Role')}</p>
                            <div className={'grid sm:grid-cols-2 lg:grid-cols-4 gap-2'}>
                                {rolePresets().map((role) => {
                                    const active = preset?.key === role.key;

                                    return (
                                        <button
                                            key={role.key}
                                            type={'button'}
                                            onClick={() => setSelected(expandGrants(role.grants, grantable))}
                                            className={classNames(
                                                'text-left rounded-xl p-3 ring-1 ring-inset transition-colors',
                                                active
                                                    ? 'bg-raptor-500/10 ring-raptor-500/50'
                                                    : 'bg-gray-950/30 ring-gray-800 hover:ring-gray-700'
                                            )}
                                        >
                                            <span className={'flex items-center justify-between gap-2'}>
                                                <span className={'text-sm font-semibold text-gray-100'}>
                                                    {role.label}
                                                </span>
                                                {active && <CheckIcon className={'w-4 h-4 text-raptor-400'} />}
                                            </span>
                                            <span className={'mt-1 block text-xs text-gray-400 leading-snug'}>
                                                {role.description}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {!preset && selected.length > 0 && (
                                <p className={'mt-2 text-xs text-gray-500'}>{t('Custom permissions are selected.')}</p>
                            )}
                        </section>
                    )}

                    {!rootAdmin && own[0] !== '*' && !readOnly && (
                        <Callout tone={'blue'}>
                            {t('You can only give permissions that your own account has on this server.')}
                        </Callout>
                    )}
                    {dangerous > 0 && !readOnly && (
                        <Callout tone={'yellow'} icon={ExclamationIcon}>
                            {t(
                                '{{count}} selected permissions allow deleting data or reading every file. Only give them to people you trust.',
                                { count: dangerous }
                            )}
                        </Callout>
                    )}

                    <section>
                        <div className={'flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2'}>
                            <p className={'text-2xs uppercase tracking-wider text-gray-500'}>{t('Permissions')}</p>
                            <label className={'relative sm:w-64'}>
                                <SearchIcon
                                    className={'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500'}
                                />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('Search permissions')}
                                    className={
                                        'w-full h-9 pl-9 pr-3 rounded-lg bg-gray-950/60 border-0 ring-1 ring-inset ring-gray-700 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500'
                                    }
                                />
                            </label>
                        </div>
                        <div className={'space-y-2'}>
                            {visible.map((group) => {
                                const keys = group.permissions.map((p) => p.key);
                                const count = keys.filter((key) => selected.includes(key)).length;
                                const open = query !== '' || !collapsed.includes(group.key);
                                const Icon = group.icon;
                                const anyEditable = keys.some(editable);

                                return (
                                    <div
                                        key={group.key}
                                        className={'rounded-xl ring-1 ring-inset ring-gray-800 bg-gray-950/20'}
                                    >
                                        <div className={'flex items-center gap-3 px-3 py-2.5'}>
                                            <button
                                                type={'button'}
                                                disabled={!anyEditable}
                                                onClick={() => toggleGroup(group)}
                                                aria-label={t('Select all')}
                                                className={'disabled:opacity-40'}
                                            >
                                                <Check
                                                    state={count === 0 ? 'off' : count === keys.length ? 'on' : 'some'}
                                                />
                                            </button>
                                            <button
                                                type={'button'}
                                                onClick={() =>
                                                    setCollapsed((c) =>
                                                        c.includes(group.key)
                                                            ? c.filter((k) => k !== group.key)
                                                            : [...c, group.key]
                                                    )
                                                }
                                                className={'flex flex-1 min-w-0 items-center gap-2.5 text-left'}
                                            >
                                                <Icon className={'w-4 h-4 flex-shrink-0 text-gray-400'} />
                                                <span className={'min-w-0 flex-1'}>
                                                    <span className={'block text-sm font-medium text-gray-100'}>
                                                        {group.label}
                                                    </span>
                                                    <span className={'block text-xs text-gray-500 leading-snug'}>
                                                        {group.description}
                                                    </span>
                                                </span>
                                                <span className={'text-xs tabular-nums text-gray-500'}>
                                                    {count}/{keys.length}
                                                </span>
                                                <ChevronDownIcon
                                                    className={classNames(
                                                        'w-4 h-4 text-gray-500 transition-transform',
                                                        !open && '-rotate-90'
                                                    )}
                                                />
                                            </button>
                                        </div>
                                        {open && (
                                            <ul className={'border-t border-gray-800/80 divide-y divide-gray-800/60'}>
                                                {group.permissions.map((permission) => {
                                                    const on = selected.includes(permission.key);
                                                    const enabled = editable(permission.key);

                                                    return (
                                                        <li key={permission.key}>
                                                            <button
                                                                type={'button'}
                                                                disabled={!enabled}
                                                                onClick={() => toggle(permission.key)}
                                                                className={classNames(
                                                                    'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                                                                    enabled
                                                                        ? 'hover:bg-white/[0.02]'
                                                                        : 'cursor-not-allowed opacity-50'
                                                                )}
                                                            >
                                                                <Check state={on ? 'on' : 'off'} />
                                                                <span className={'min-w-0 flex-1'}>
                                                                    <span
                                                                        className={
                                                                            'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-200'
                                                                        }
                                                                    >
                                                                        {permission.label}
                                                                        {permission.danger && (
                                                                            <span
                                                                                className={
                                                                                    'text-[0.65rem] font-medium uppercase tracking-wide text-amber-300'
                                                                                }
                                                                            >
                                                                                {t('Sensitive')}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span
                                                                        className={
                                                                            'block text-xs text-gray-500 leading-snug'
                                                                        }
                                                                    >
                                                                        {permission.description}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                            {visible.length === 0 && (
                                <p className={'py-6 text-center text-sm text-gray-500'}>
                                    {t('No permissions match your search.')}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </Modal>
    );
};

export default SubuserEditor;
