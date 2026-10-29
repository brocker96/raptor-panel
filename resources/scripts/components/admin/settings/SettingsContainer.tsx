import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
    AdjustmentsIcon,
    ChatAlt2Icon,
    ClockIcon,
    CloudIcon,
    CogIcon,
    ExclamationIcon,
    GlobeAltIcon,
    LockClosedIcon,
    MailIcon,
    PaperAirplaneIcon,
    ShieldCheckIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { useStoreActions, useStoreState } from '@/state/hooks';
import {
    getSettings,
    PanelSettings,
    sendTestMail,
    updateMailDriver,
    updateSettings,
    enableDatabaseSettings,
} from '@/api/admin';
import { Page, Segmented, Tabs } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { FormGrid, NumberInput, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { useAction } from '@/components/admin/ui/hooks';
import CloudflareSettings from '@/components/admin/settings/CloudflareSettings';
import { t } from '@/i18n';

const useSection = <K extends 'general' | 'mail' | 'advanced' | 'security'>(settings: PanelSettings, key: K) => {
    const [values, setValues] = useState<PanelSettings[K]>(settings[key]);
    useEffect(() => setValues(settings[key]), [settings]);

    const save = useAction((v: object) => updateSettings(key, v), {
        success: t('Settings saved'),
        invalidate: [['admin', 'settings']],
    });
    const set = (field: keyof PanelSettings[K]) => (value: unknown) => setValues({ ...values, [field]: value });

    return { values, set, save };
};

const EnvironmentOnlyNotice = () => {
    const fix = useAction(enableDatabaseSettings, {
        success: t('Settings from the admin area are used now'),
        invalidate: [['admin', 'settings']],
    });

    return (
        <div className={'mb-6'}>
            <Callout tone={'red'} icon={ExclamationIcon} title={t('Changes on these pages are ignored')}>
                <p>
                    {t(
                        'APP_ENVIRONMENT_ONLY=true is set in the .env file, so the Panel only reads the .env file and everything saved here has no effect. Older installers set it by mistake.'
                    )}
                </p>
                <Button size={'sm'} className={'mt-3'} loading={fix.loading} onClick={() => fix.run()}>
                    {t('Use the settings from the admin area')}
                </Button>
            </Callout>
        </div>
    );
};

const General = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'general');
    const site = useStoreState((state) => state.settings.data!);
    const setSite = useStoreActions((actions) => actions.settings.setSettings);

    // The Support entries in the navigation follow the switch without reloading the page.
    const submit = () =>
        save
            .run(values)
            .then(
                (saved) =>
                    saved !== undefined && setSite({ ...site, support: values['raptor:support:enabled'] === 'true' })
            );

    return (
        <Card
            title={t('General')}
            icon={CogIcon}
            footer={
                <Button loading={save.loading} onClick={submit}>
                    {t('Save')}
                </Button>
            }
        >
            <div className={'space-y-4'}>
                <FormGrid>
                    <TextInput
                        label={t('Company name')}
                        required
                        value={values['app:name']}
                        onChange={set('app:name')}
                        error={save.errors['app:name']}
                        description={t('Shown in the browser tab, e-mails and on the login page.')}
                    />
                    <Select
                        label={t('Default language')}
                        value={values['app:locale']}
                        onChange={set('app:locale')}
                        options={Object.entries(settings.meta.languages).map(([value, label]) => ({ value, label }))}
                    />
                </FormGrid>
                <div>
                    <p className={'mb-2 flex items-center gap-2 text-xs font-medium text-gray-300'}>
                        <ShieldCheckIcon className={'w-4 h-4 text-raptor-400'} />{' '}
                        {t('Require two-factor authentication')}
                    </p>
                    <Segmented
                        id={'2fa'}
                        value={String(values['raptor:auth:2fa_required'])}
                        onChange={(value) => set('raptor:auth:2fa_required')(Number(value))}
                        options={[
                            { value: '0', label: t('Not required') },
                            { value: '1', label: t('Admins only') },
                            { value: '2', label: t('All users') },
                        ]}
                    />
                    <p className={'mt-2 text-xs text-gray-500'}>
                        {t('Affected users must set up 2FA before they can continue using the Panel.')}
                    </p>
                </div>
                <div className={'space-y-2'}>
                    <p className={'flex items-center gap-2 text-xs font-medium text-gray-300'}>
                        <ChatAlt2Icon className={'w-4 h-4 text-raptor-400'} /> {t('Support tickets')}
                    </p>
                    <Toggle
                        label={t('Enable support tickets')}
                        description={t(
                            'Users get a Support page to contact you and you answer in Admin → Support. Useful for hosting companies, a private Panel does not need it. Turned off, the pages and the API are gone.'
                        )}
                        checked={values['raptor:support:enabled'] === 'true'}
                        onChange={(v) => set('raptor:support:enabled')(v ? 'true' : 'false')}
                    />
                    {values['raptor:support:enabled'] === 'true' && (
                        <Toggle
                            label={t('Email about tickets')}
                            description={t('Administrators get new tickets, users get answers from the team.')}
                            checked={values['raptor:support:mail'] === 'true'}
                            onChange={(v) => set('raptor:support:mail')(v ? 'true' : 'false')}
                        />
                    )}
                </div>
            </div>
        </Card>
    );
};

const Mail = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'mail');
    const [password, setPassword] = useState('');
    const test = useAction(sendTestMail, { success: (r) => t('Test e-mail sent to {{email}}', { email: r.email }) });
    const driver = useAction((value: 'smtp' | 'log') => updateMailDriver(value), {
        success: t('Mail delivery updated'),
        invalidate: [
            ['admin', 'settings'],
            ['admin', 'system'],
        ],
    });

    const switcher = settings.meta.mail_switchable && (
        <Card title={t('Delivery')} icon={MailIcon} description={t('Where e-mails sent by the Panel go.')}>
            <div className={'flex flex-col sm:flex-row sm:items-center gap-3'}>
                <Segmented
                    id={'mail-driver'}
                    value={settings.meta.mail_driver === 'smtp' ? 'smtp' : 'log'}
                    onChange={(value) => driver.run(value as 'smtp' | 'log')}
                    options={[
                        { value: 'smtp', label: t('Send over SMTP') },
                        { value: 'log', label: t('Off (log only)') },
                    ]}
                />
                <p className={'text-xs text-gray-500'}>
                    {settings.meta.mail_driver === 'smtp'
                        ? t('E-mails are delivered through the SMTP server below.')
                        : t(
                              'E-mails are written to storage/logs instead of being sent. Users cannot reset their passwords by e-mail.'
                          )}
                </p>
            </div>
        </Card>
    );

    if (!settings.meta.mail_editable) {
        if (switcher) return switcher;

        return (
            <Card title={t('Mail')} icon={MailIcon}>
                <Callout
                    tone={'yellow'}
                    title={t('The mail driver is "{{mail_driver}}"', { mail_driver: settings.meta.mail_driver })}
                >
                    {t('Mail settings can only be edited here when')} <code>MAIL_MAILER=smtp</code>
                    {t('. Configure other drivers in the')} <code>.env</code> {t('file.')}
                </Callout>
                <Button
                    className={'mt-4'}
                    variant={'secondary'}
                    icon={PaperAirplaneIcon}
                    loading={test.loading}
                    onClick={() => test.run()}
                >
                    {t('Send test e-mail')}
                </Button>
            </Card>
        );
    }

    return (
        <div className={'space-y-6'}>
            {switcher}
            <Card
                title={t('SMTP')}
                icon={MailIcon}
                description={t('Used for password resets, invitations and notifications.')}
                footer={
                    <>
                        <Button
                            variant={'secondary'}
                            icon={PaperAirplaneIcon}
                            loading={test.loading}
                            onClick={() => test.run()}
                        >
                            {t('Send test e-mail')}
                        </Button>
                        <Button
                            loading={save.loading}
                            onClick={() => save.run({ ...values, 'mail:mailers:smtp:password': password || undefined })}
                        >
                            {t('Save')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <FormGrid cols={3}>
                        <TextInput
                            label={t('SMTP host')}
                            required
                            value={values['mail:mailers:smtp:host'] || ''}
                            onChange={set('mail:mailers:smtp:host')}
                            error={save.errors['mail:mailers:smtp:host']}
                            placeholder={'smtp.example.com'}
                        />
                        <NumberInput
                            label={t('Port')}
                            required
                            value={values['mail:mailers:smtp:port']}
                            onChange={set('mail:mailers:smtp:port')}
                            error={save.errors['mail:mailers:smtp:port']}
                        />
                        <Select
                            label={t('Encryption')}
                            value={values['mail:mailers:smtp:encryption'] || ''}
                            onChange={(v) => set('mail:mailers:smtp:encryption')(v || null)}
                            options={[
                                { value: 'tls', label: t('TLS (STARTTLS, port 587)') },
                                { value: 'ssl', label: t('SSL (port 465)') },
                                { value: '', label: t('None') },
                            ]}
                        />
                    </FormGrid>
                    <FormGrid>
                        <TextInput
                            label={t('Username')}
                            value={values['mail:mailers:smtp:username'] || ''}
                            onChange={set('mail:mailers:smtp:username')}
                            error={save.errors['mail:mailers:smtp:username']}
                            autoComplete={'off'}
                        />
                        <TextInput
                            label={t('Password')}
                            type={'password'}
                            value={password}
                            onChange={setPassword}
                            autoComplete={'new-password'}
                            placeholder={settings.meta.mail_password_set ? '••••••••' : ''}
                            description={
                                settings.meta.mail_password_set
                                    ? t('Stored encrypted. Leave empty to keep it, enter !e to remove it.')
                                    : undefined
                            }
                        />
                        <TextInput
                            label={t('From address')}
                            required
                            type={'email'}
                            value={values['mail:from:address']}
                            onChange={set('mail:from:address')}
                            error={save.errors['mail:from:address']}
                            placeholder={t('no-reply@example.com')}
                        />
                        <TextInput
                            label={t('From name')}
                            value={values['mail:from:name'] || ''}
                            onChange={set('mail:from:name')}
                            placeholder={t('Raptor Panel')}
                        />
                    </FormGrid>
                </div>
            </Card>
        </div>
    );
};

const Advanced = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'advanced');
    const recaptcha = values['recaptcha:enabled'] === 'true';
    const allocations = values['raptor:client_features:allocations:enabled'] === 'true';

    return (
        <div className={'space-y-6'}>
            <Card
                title={t('reCAPTCHA')}
                icon={ShieldCheckIcon}
                description={t('Invisible bot protection for the login and password reset forms.')}
            >
                <div className={'space-y-4'}>
                    <Toggle
                        label={t('Enable reCAPTCHA')}
                        checked={recaptcha}
                        onChange={(v) => set('recaptcha:enabled')(v ? 'true' : 'false')}
                    />
                    {recaptcha && settings.meta.recaptcha_shipped_keys && (
                        <Callout tone={'yellow'} title={t('You are using the default keys')}>
                            {t(
                                'These keys are shared by every installation. Create your own reCAPTCHA v2 (invisible) keys for your domain.'
                            )}
                        </Callout>
                    )}
                    <FormGrid>
                        <TextInput
                            label={t('Site key')}
                            value={values['recaptcha:website_key']}
                            onChange={set('recaptcha:website_key')}
                            error={save.errors['recaptcha:website_key']}
                        />
                        <TextInput
                            label={t('Secret key')}
                            value={values['recaptcha:secret_key']}
                            onChange={set('recaptcha:secret_key')}
                            error={save.errors['recaptcha:secret_key']}
                        />
                    </FormGrid>
                </div>
            </Card>
            <Card
                title={t('Node connections')}
                icon={AdjustmentsIcon}
                description={t('How long the Panel waits for Wings.')}
            >
                <FormGrid>
                    <NumberInput
                        label={t('Connection timeout')}
                        suffix={'seconds'}
                        value={values['raptor:guzzle:connect_timeout']}
                        onChange={set('raptor:guzzle:connect_timeout')}
                        error={save.errors['raptor:guzzle:connect_timeout']}
                    />
                    <NumberInput
                        label={t('Request timeout')}
                        suffix={'seconds'}
                        value={values['raptor:guzzle:timeout']}
                        onChange={set('raptor:guzzle:timeout')}
                        error={save.errors['raptor:guzzle:timeout']}
                    />
                </FormGrid>
            </Card>
            <Card
                title={t('Automatic allocations')}
                description={t('Let server owners add ports themselves, up to the allocation limit of their server.')}
                footer={
                    <Button loading={save.loading} onClick={() => save.run(values)}>
                        {t('Save advanced settings')}
                    </Button>
                }
            >
                <div className={'space-y-4'}>
                    <Toggle
                        label={t('Allow users to create allocations')}
                        checked={allocations}
                        onChange={(v) => set('raptor:client_features:allocations:enabled')(v ? 'true' : 'false')}
                    />
                    {allocations && (
                        <FormGrid>
                            <NumberInput
                                label={t('Starting port')}
                                value={values['raptor:client_features:allocations:range_start']}
                                onChange={set('raptor:client_features:allocations:range_start')}
                                error={save.errors['raptor:client_features:allocations:range_start']}
                            />
                            <NumberInput
                                label={t('Ending port')}
                                value={values['raptor:client_features:allocations:range_end']}
                                onChange={set('raptor:client_features:allocations:range_end')}
                                error={save.errors['raptor:client_features:allocations:range_end']}
                            />
                        </FormGrid>
                    )}
                </div>
            </Card>
        </div>
    );
};

const Security = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'security');
    const flag = (key: keyof PanelSettings['security']) => values[key] === 'true';
    const toggle = (key: keyof PanelSettings['security']) => (v: boolean) => set(key)(v ? 'true' : 'false');
    const footer = (
        <Button loading={save.loading} onClick={() => save.run(values)}>
            {t('Save security settings')}
        </Button>
    );

    return (
        <div className={'space-y-6'}>
            <Card
                title={t('Sessions')}
                icon={ClockIcon}
                description={t(
                    'How long users stay signed in. Users see and end their sessions on their Security page.'
                )}
            >
                <FormGrid>
                    <NumberInput
                        label={t('Keep me signed in for')}
                        suffix={t('days')}
                        value={values['raptor:security:session_days']}
                        onChange={set('raptor:security:session_days')}
                        error={save.errors['raptor:security:session_days']}
                        description={t('How long a device stays signed in when "Keep me signed in" is chosen.')}
                    />
                    <NumberInput
                        label={t('Sign out after inactivity')}
                        suffix={t('minutes')}
                        value={values['raptor:security:idle_timeout']}
                        onChange={set('raptor:security:idle_timeout')}
                        error={save.errors['raptor:security:idle_timeout']}
                        description={t('Ends sessions without any activity for this long. 0 disables it.')}
                    />
                    <NumberInput
                        label={t('Maximum screen lock delay')}
                        suffix={t('minutes')}
                        value={values['raptor:security:screen_lock_max']}
                        onChange={set('raptor:security:screen_lock_max')}
                        error={save.errors['raptor:security:screen_lock_max']}
                        description={t(
                            'Forces the screen lock for every user after at most this many idle minutes. 0 lets users decide.'
                        )}
                    />
                    <NumberInput
                        label={t('Trust devices for')}
                        suffix={t('days')}
                        value={values['raptor:security:trusted_device_days']}
                        onChange={set('raptor:security:trusted_device_days')}
                        error={save.errors['raptor:security:trusted_device_days']}
                        description={t(
                            'Lets users skip the two-step code on a trusted browser. 0 disables trusted devices.'
                        )}
                    />
                </FormGrid>
            </Card>
            <Card
                title={t('Sign-in protection')}
                icon={LockClosedIcon}
                description={t('Accounts are locked for a while after too many failed sign-ins, from any address.')}
            >
                <div className={'space-y-4'}>
                    <FormGrid>
                        <NumberInput
                            label={t('Failed sign-ins before locking')}
                            value={values['raptor:security:lockout_attempts']}
                            onChange={set('raptor:security:lockout_attempts')}
                            error={save.errors['raptor:security:lockout_attempts']}
                            description={t('0 disables account locking.')}
                        />
                        <NumberInput
                            label={t('Lock duration')}
                            suffix={t('minutes')}
                            value={values['raptor:security:lockout_minutes']}
                            onChange={set('raptor:security:lockout_minutes')}
                            error={save.errors['raptor:security:lockout_minutes']}
                        />
                        <NumberInput
                            label={t('Minimum password length')}
                            suffix={t('characters')}
                            value={values['raptor:security:password_min_length']}
                            onChange={set('raptor:security:password_min_length')}
                            error={save.errors['raptor:security:password_min_length']}
                        />
                    </FormGrid>
                    <Toggle
                        label={t('Allow passkeys')}
                        description={t(
                            'Users can sign in with fingerprint, face or security keys instead of a password. Requires HTTPS.'
                        )}
                        checked={flag('raptor:security:passkeys')}
                        onChange={toggle('raptor:security:passkeys')}
                    />
                    <Toggle
                        label={t('Security alert e-mails')}
                        description={t(
                            'E-mail users about sign-ins from new devices and changes to their password, e-mail, two-step verification, passkeys and PIN.'
                        )}
                        checked={flag('raptor:security:alerts')}
                        onChange={toggle('raptor:security:alerts')}
                    />
                </div>
            </Card>
            <Card
                title={t('Sensitive actions')}
                icon={ShieldCheckIcon}
                description={t(
                    'Deleting backups, changing subusers, reinstalling servers, API keys and similar actions ask users to confirm it is them.'
                )}
            >
                <div className={'space-y-4'}>
                    <FormGrid>
                        <NumberInput
                            label={t('Confirmation stays valid for')}
                            suffix={t('minutes')}
                            value={values['raptor:security:confirm_window']}
                            onChange={set('raptor:security:confirm_window')}
                            error={save.errors['raptor:security:confirm_window']}
                        />
                    </FormGrid>
                    <Toggle
                        label={t('Confirm changes in the admin area')}
                        description={t(
                            'Administrators confirm with their password, code, passkey or PIN before their first change in the admin area.'
                        )}
                        checked={flag('raptor:security:confirm_admin')}
                        onChange={toggle('raptor:security:confirm_admin')}
                    />
                </div>
            </Card>
            <Card
                title={t('Admin area access')}
                icon={GlobeAltIcon}
                description={t(
                    'Only these IP addresses or CIDR ranges can open the admin area. Leave empty to allow every address.'
                )}
                footer={footer}
            >
                <div className={'space-y-3'}>
                    <TextArea
                        mono
                        label={t('Allowed addresses')}
                        value={values['raptor:security:admin_allowlist'] || ''}
                        onChange={set('raptor:security:admin_allowlist')}
                        error={save.errors['raptor:security:admin_allowlist']}
                        placeholder={'203.0.113.10\n10.0.0.0/8'}
                    />
                    <p className={'text-xs text-gray-500'}>
                        {t('Your current address is {{ip}}. It must be in the list, otherwise saving is refused.', {
                            ip: settings.meta.ip,
                        })}
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default () => {
    const { data } = useResource(['admin', 'settings'], getSettings);
    const section = useLocation().pathname.split('/')[3] || 'general';

    return (
        <Page
            title={t('Settings')}
            icon={CogIcon}
            description={t('Panel wide configuration. Changes apply immediately and restart the queue worker.')}
            guide={section === 'cloudflare' ? 'cloudflare' : `settings-${section}`}
            tabs={
                <Tabs
                    id={'settings'}
                    items={[
                        { to: '/admin/settings/general', label: t('General'), icon: CogIcon },
                        { to: '/admin/settings/mail', label: t('Mail'), icon: MailIcon },
                        { to: '/admin/settings/security', label: t('Security'), icon: ShieldCheckIcon },
                        { to: '/admin/settings/advanced', label: t('Advanced'), icon: AdjustmentsIcon },
                        { to: '/admin/settings/cloudflare', label: t('Cloudflare'), icon: CloudIcon },
                    ]}
                />
            }
        >
            {data?.meta.environment_only && <EnvironmentOnlyNotice />}
            <Routes>
                <Route index element={<Navigate to={'general'} replace />} />
                <Route path={'cloudflare'} element={<CloudflareSettings />} />
                <Route
                    path={'*'}
                    element={
                        !data ? (
                            <Skeleton className={'h-80 rounded-xl'} />
                        ) : (
                            <Routes>
                                <Route path={'general'} element={<General settings={data} />} />
                                <Route path={'mail'} element={<Mail settings={data} />} />
                                <Route path={'security'} element={<Security settings={data} />} />
                                <Route path={'advanced'} element={<Advanced settings={data} />} />
                            </Routes>
                        )
                    }
                />
            </Routes>
        </Page>
    );
};
