import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
    AdjustmentsIcon,
    CloudIcon,
    CogIcon,
    MailIcon,
    PaperAirplaneIcon,
    ShieldCheckIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getSettings, PanelSettings, sendTestMail, updateMailDriver, updateSettings } from '@/api/admin';
import { Page, Segmented, Tabs } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { FormGrid, NumberInput, Select, TextInput, Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { useAction } from '@/components/admin/ui/hooks';
import CloudflareSettings from '@/components/admin/settings/CloudflareSettings';

const useSection = <K extends 'general' | 'mail' | 'advanced'>(settings: PanelSettings, key: K) => {
    const [values, setValues] = useState<PanelSettings[K]>(settings[key]);
    useEffect(() => setValues(settings[key]), [settings]);

    const save = useAction((v: object) => updateSettings(key, v), {
        success: 'Settings saved',
        invalidate: [['admin', 'settings']],
    });
    const set = (field: keyof PanelSettings[K]) => (value: unknown) => setValues({ ...values, [field]: value });

    return { values, set, save };
};

const General = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'general');

    return (
        <Card
            title={'General'}
            icon={CogIcon}
            footer={
                <Button loading={save.loading} onClick={() => save.run(values)}>
                    Save
                </Button>
            }
        >
            <div className={'space-y-4'}>
                <FormGrid>
                    <TextInput
                        label={'Company name'}
                        required
                        value={values['app:name']}
                        onChange={set('app:name')}
                        error={save.errors['app:name']}
                        description={'Shown in the browser tab, e-mails and on the login page.'}
                    />
                    <Select
                        label={'Default language'}
                        value={values['app:locale']}
                        onChange={set('app:locale')}
                        options={Object.entries(settings.meta.languages).map(([value, label]) => ({ value, label }))}
                    />
                </FormGrid>
                <div>
                    <p className={'mb-2 flex items-center gap-2 text-xs font-medium text-gray-300'}>
                        <ShieldCheckIcon className={'w-4 h-4 text-raptor-400'} /> Require two-factor authentication
                    </p>
                    <Segmented
                        id={'2fa'}
                        value={String(values['raptor:auth:2fa_required'])}
                        onChange={(value) => set('raptor:auth:2fa_required')(Number(value))}
                        options={[
                            { value: '0', label: 'Not required' },
                            { value: '1', label: 'Admins only' },
                            { value: '2', label: 'All users' },
                        ]}
                    />
                    <p className={'mt-2 text-xs text-gray-500'}>
                        Affected users must set up 2FA before they can continue using the Panel.
                    </p>
                </div>
            </div>
        </Card>
    );
};

const Mail = ({ settings }: { settings: PanelSettings }) => {
    const { values, set, save } = useSection(settings, 'mail');
    const [password, setPassword] = useState('');
    const test = useAction(sendTestMail, { success: (r) => `Test e-mail sent to ${r.email}` });
    const driver = useAction((value: 'smtp' | 'log') => updateMailDriver(value), {
        success: 'Mail delivery updated',
        invalidate: [
            ['admin', 'settings'],
            ['admin', 'system'],
        ],
    });

    const switcher = settings.meta.mail_switchable && (
        <Card title={'Delivery'} icon={MailIcon} description={'Where e-mails sent by the Panel go.'}>
            <div className={'flex flex-col sm:flex-row sm:items-center gap-3'}>
                <Segmented
                    id={'mail-driver'}
                    value={settings.meta.mail_driver === 'smtp' ? 'smtp' : 'log'}
                    onChange={(value) => driver.run(value as 'smtp' | 'log')}
                    options={[
                        { value: 'smtp', label: 'Send over SMTP' },
                        { value: 'log', label: 'Off (log only)' },
                    ]}
                />
                <p className={'text-xs text-gray-500'}>
                    {settings.meta.mail_driver === 'smtp'
                        ? 'E-mails are delivered through the SMTP server below.'
                        : 'E-mails are written to storage/logs instead of being sent. Users cannot reset their passwords by e-mail.'}
                </p>
            </div>
        </Card>
    );

    if (!settings.meta.mail_editable) {
        if (switcher) return switcher;

        return (
            <Card title={'Mail'} icon={MailIcon}>
                <Callout tone={'yellow'} title={`The mail driver is "${settings.meta.mail_driver}"`}>
                    Mail settings can only be edited here when <code>MAIL_MAILER=smtp</code>. Configure other drivers in
                    the <code>.env</code> file.
                </Callout>
                <Button
                    className={'mt-4'}
                    variant={'secondary'}
                    icon={PaperAirplaneIcon}
                    loading={test.loading}
                    onClick={() => test.run()}
                >
                    Send test e-mail
                </Button>
            </Card>
        );
    }

    return (
        <div className={'space-y-6'}>
            {switcher}
            <Card
                title={'SMTP'}
                icon={MailIcon}
                description={'Used for password resets, invitations and notifications.'}
                footer={
                    <>
                        <Button
                            variant={'secondary'}
                            icon={PaperAirplaneIcon}
                            loading={test.loading}
                            onClick={() => test.run()}
                        >
                            Send test e-mail
                        </Button>
                        <Button
                            loading={save.loading}
                            onClick={() => save.run({ ...values, 'mail:mailers:smtp:password': password || undefined })}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <FormGrid cols={3}>
                        <TextInput
                            label={'SMTP host'}
                            required
                            value={values['mail:mailers:smtp:host'] || ''}
                            onChange={set('mail:mailers:smtp:host')}
                            error={save.errors['mail:mailers:smtp:host']}
                            placeholder={'smtp.example.com'}
                        />
                        <NumberInput
                            label={'Port'}
                            required
                            value={values['mail:mailers:smtp:port']}
                            onChange={set('mail:mailers:smtp:port')}
                            error={save.errors['mail:mailers:smtp:port']}
                        />
                        <Select
                            label={'Encryption'}
                            value={values['mail:mailers:smtp:encryption'] || ''}
                            onChange={(v) => set('mail:mailers:smtp:encryption')(v || null)}
                            options={[
                                { value: 'tls', label: 'TLS (STARTTLS, port 587)' },
                                { value: 'ssl', label: 'SSL (port 465)' },
                                { value: '', label: 'None' },
                            ]}
                        />
                    </FormGrid>
                    <FormGrid>
                        <TextInput
                            label={'Username'}
                            value={values['mail:mailers:smtp:username'] || ''}
                            onChange={set('mail:mailers:smtp:username')}
                            error={save.errors['mail:mailers:smtp:username']}
                            autoComplete={'off'}
                        />
                        <TextInput
                            label={'Password'}
                            type={'password'}
                            value={password}
                            onChange={setPassword}
                            autoComplete={'new-password'}
                            placeholder={settings.meta.mail_password_set ? '••••••••' : ''}
                            description={
                                settings.meta.mail_password_set
                                    ? 'Stored encrypted. Leave empty to keep it, enter !e to remove it.'
                                    : undefined
                            }
                        />
                        <TextInput
                            label={'From address'}
                            required
                            type={'email'}
                            value={values['mail:from:address']}
                            onChange={set('mail:from:address')}
                            error={save.errors['mail:from:address']}
                            placeholder={'no-reply@example.com'}
                        />
                        <TextInput
                            label={'From name'}
                            value={values['mail:from:name'] || ''}
                            onChange={set('mail:from:name')}
                            placeholder={'Raptor Panel'}
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
                title={'reCAPTCHA'}
                icon={ShieldCheckIcon}
                description={'Invisible bot protection for the login and password reset forms.'}
            >
                <div className={'space-y-4'}>
                    <Toggle
                        label={'Enable reCAPTCHA'}
                        checked={recaptcha}
                        onChange={(v) => set('recaptcha:enabled')(v ? 'true' : 'false')}
                    />
                    {recaptcha && settings.meta.recaptcha_shipped_keys && (
                        <Callout tone={'yellow'} title={'You are using the default keys'}>
                            These keys are shared by every installation. Create your own reCAPTCHA v2 (invisible) keys
                            for your domain.
                        </Callout>
                    )}
                    <FormGrid>
                        <TextInput
                            label={'Site key'}
                            value={values['recaptcha:website_key']}
                            onChange={set('recaptcha:website_key')}
                            error={save.errors['recaptcha:website_key']}
                        />
                        <TextInput
                            label={'Secret key'}
                            value={values['recaptcha:secret_key']}
                            onChange={set('recaptcha:secret_key')}
                            error={save.errors['recaptcha:secret_key']}
                        />
                    </FormGrid>
                </div>
            </Card>
            <Card title={'Node connections'} icon={AdjustmentsIcon} description={'How long the Panel waits for Wings.'}>
                <FormGrid>
                    <NumberInput
                        label={'Connection timeout'}
                        suffix={'seconds'}
                        value={values['raptor:guzzle:connect_timeout']}
                        onChange={set('raptor:guzzle:connect_timeout')}
                        error={save.errors['raptor:guzzle:connect_timeout']}
                    />
                    <NumberInput
                        label={'Request timeout'}
                        suffix={'seconds'}
                        value={values['raptor:guzzle:timeout']}
                        onChange={set('raptor:guzzle:timeout')}
                        error={save.errors['raptor:guzzle:timeout']}
                    />
                </FormGrid>
            </Card>
            <Card
                title={'Automatic allocations'}
                description={'Let server owners add ports themselves, up to the allocation limit of their server.'}
                footer={
                    <Button loading={save.loading} onClick={() => save.run(values)}>
                        Save advanced settings
                    </Button>
                }
            >
                <div className={'space-y-4'}>
                    <Toggle
                        label={'Allow users to create allocations'}
                        checked={allocations}
                        onChange={(v) => set('raptor:client_features:allocations:enabled')(v ? 'true' : 'false')}
                    />
                    {allocations && (
                        <FormGrid>
                            <NumberInput
                                label={'Starting port'}
                                value={values['raptor:client_features:allocations:range_start']}
                                onChange={set('raptor:client_features:allocations:range_start')}
                                error={save.errors['raptor:client_features:allocations:range_start']}
                            />
                            <NumberInput
                                label={'Ending port'}
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

export default () => {
    const { data } = useResource(['admin', 'settings'], getSettings);
    const section = useLocation().pathname.split('/')[3] || 'general';

    return (
        <Page
            title={'Settings'}
            icon={CogIcon}
            description={'Panel wide configuration. Changes apply immediately and restart the queue worker.'}
            guide={section === 'cloudflare' ? 'cloudflare' : `settings-${section}`}
            tabs={
                <Tabs
                    id={'settings'}
                    items={[
                        { to: '/admin/settings/general', label: 'General', icon: CogIcon },
                        { to: '/admin/settings/mail', label: 'Mail', icon: MailIcon },
                        { to: '/admin/settings/advanced', label: 'Advanced', icon: AdjustmentsIcon },
                        { to: '/admin/settings/cloudflare', label: 'Cloudflare', icon: CloudIcon },
                    ]}
                />
            }
        >
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
                                <Route path={'advanced'} element={<Advanced settings={data} />} />
                            </Routes>
                        )
                    }
                />
            </Routes>
        </Page>
    );
};
