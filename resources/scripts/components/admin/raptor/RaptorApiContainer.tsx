import React, { useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import {
    BeakerIcon,
    BookOpenIcon,
    KeyIcon,
    LightningBoltIcon,
    PlusIcon,
    RefreshIcon,
    TrashIcon,
    ViewListIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    createBillingKey,
    createWebhook,
    deleteWebhook,
    getDeliveries,
    getRaptorOverview,
    getWebhooks,
    redeliver,
    rotateWebhookSecret,
    testWebhook,
    updateWebhook,
    Webhook,
    WebhookValues,
} from '@/api/raptor';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { TextInput } from '@/components/admin/ui/Form';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import CheckList from '@/components/admin/ui/CheckList';
import { ago, useAction } from '@/components/admin/ui/hooks';
import CopyField from '@/components/ui/CopyField';
import Modal from '@/components/ui/Modal';
import { t } from '@/i18n';

const Code = ({ children }: { children: string }) => (
    <pre
        className={
            'overflow-x-auto rounded-lg bg-gray-950/80 ring-1 ring-inset ring-gray-800 p-4 text-xs leading-relaxed text-gray-200 font-mono'
        }
    >
        {children}
    </pre>
);

const example = (base: string, token = 'YOUR_KEY') => `curl -X POST ${base}/servers \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-1042" \\
  -d '{
    "package": "minecraft-4gb",
    "external_id": "order-1042",
    "user": { "email": "jane@example.com", "external_id": "client-7" },
    "login_link": true
  }'`;

const KeyModal = ({ open, onClose, base }: { open: boolean; onClose: () => void; base: string }) => {
    const [memo, setMemo] = useState('Billing');
    const [ips, setIps] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const create = useAction(() => createBillingKey(memo, ips.split(/[\s,]+/).filter(Boolean)), {
        invalidate: [['admin', 'raptor-api']],
        onSuccess: (r) => setToken(r.token),
    });
    const dismiss = () => {
        onClose();
        setTimeout(() => setToken(null), 300);
    };

    return (
        <Modal
            open={open}
            onClose={dismiss}
            icon={KeyIcon}
            size={'lg'}
            title={token ? t('Your billing key') : t('Create a billing key')}
            description={
                token
                    ? t('Copy it now, it is shown only once. Store it in the settings of your billing system.')
                    : t('An application key with exactly the permissions the Raptor API needs.')
            }
            footer={
                token ? (
                    <Button onClick={dismiss}>{t('Done')}</Button>
                ) : (
                    <>
                        <Button variant={'secondary'} onClick={dismiss}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            icon={KeyIcon}
                            loading={create.loading}
                            disabled={!memo.trim()}
                            onClick={() => create.run()}
                        >
                            {t('Create key')}
                        </Button>
                    </>
                )
            }
        >
            {token ? (
                <div className={'space-y-4'}>
                    <CopyField label={t('API key')} value={token} mono />
                    <Code>{example(base, token)}</Code>
                </div>
            ) : (
                <div className={'space-y-4'}>
                    <TextInput label={t('Name')} value={memo} onChange={setMemo} error={create.errors.memo} required />
                    <TextInput
                        label={t('Allowed IP addresses')}
                        value={ips}
                        onChange={setIps}
                        placeholder={'203.0.113.10'}
                        description={t('Recommended: the address of your billing server. Empty allows every address.')}
                        error={create.errors['allowed_ips.0']}
                    />
                </div>
            )}
        </Modal>
    );
};

const WebhookDrawer = ({ open, onClose, events }: { open: boolean; onClose: () => void; events: string[] }) => {
    const [values, setValues] = useState<WebhookValues>({ url: '', events: [], description: '', active: true });
    const [secret, setSecret] = useState<string | null>(null);
    const create = useAction(createWebhook, {
        success: t('Webhook created'),
        invalidate: [['admin', 'raptor-api']],
        onSuccess: (hook) => setSecret(hook.secret),
    });
    const dismiss = () => {
        onClose();
        setTimeout(() => {
            setSecret(null);
            setValues({ url: '', events: [], description: '', active: true });
        }, 300);
    };

    return (
        <Drawer
            open={open}
            onClose={dismiss}
            icon={LightningBoltIcon}
            title={t('New webhook')}
            description={t('The Panel posts signed JSON to this URL whenever one of the events happens.')}
            footer={
                secret ? (
                    <Button onClick={dismiss}>{t('Done')}</Button>
                ) : (
                    <>
                        <Button variant={'secondary'} onClick={dismiss}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={create.loading} onClick={() => create.run(values)}>
                            {t('Create webhook')}
                        </Button>
                    </>
                )
            }
        >
            {secret ? (
                <div className={'space-y-4'}>
                    <Callout tone={'green'} title={t('Signing secret')}>
                        {t('Copy it now, it is shown only once. Verify the X-Raptor-Signature header with it.')}
                    </Callout>
                    <CopyField label={t('Secret')} value={secret} mono />
                </div>
            ) : (
                <div className={'space-y-4'}>
                    <TextInput
                        label={t('URL')}
                        required
                        value={values.url}
                        placeholder={'https://billing.example.com/raptor/webhook'}
                        error={create.errors.url}
                        onChange={(url) => setValues({ ...values, url })}
                    />
                    <TextInput
                        label={t('Description')}
                        value={values.description}
                        onChange={(description) => setValues({ ...values, description })}
                    />
                    <div>
                        <p className={'mb-2 text-xs font-medium text-gray-300'}>{t('Events')}</p>
                        <CheckList
                            options={events.map((event, i) => ({ id: i, label: event }))}
                            selected={values.events.map((e) => events.indexOf(e))}
                            onChange={(ids) => setValues({ ...values, events: ids.map((i) => events[i]) })}
                        />
                        <p className={'mt-2 text-xs text-gray-500'}>{t('Nothing selected sends every event.')}</p>
                    </div>
                </div>
            )}
        </Drawer>
    );
};

const Deliveries = ({ hook, onClose }: { hook: Webhook | null; onClose: () => void }) => {
    const { data, mutate } = useResource(
        ['admin', 'raptor-api', 'deliveries', hook?.id],
        (signal) => getDeliveries(hook!.id, signal),
        { enabled: !!hook, refetchInterval: 5000 }
    );
    const [open, setOpen] = useState<number | null>(null);
    const retry = useAction((id: number) => redeliver(hook!.id, id), {
        success: t('Delivery queued'),
        onSuccess: () => mutate(),
    });

    return (
        <Drawer
            open={!!hook}
            onClose={onClose}
            wide
            icon={ViewListIcon}
            title={t('Deliveries')}
            description={hook?.url}
        >
            {!data ? (
                <Skeleton className={'h-40'} />
            ) : !data.length ? (
                <EmptyState
                    icon={ViewListIcon}
                    title={t('Nothing delivered yet')}
                    description={t('Send a test event to try it.')}
                />
            ) : (
                <ul className={'divide-y divide-gray-800 -mx-1'}>
                    {data.map((d) => (
                        <li key={d.id} className={'px-1 py-3'}>
                            <button
                                type={'button'}
                                onClick={() => setOpen(open === d.id ? null : d.id)}
                                className={'w-full flex items-center gap-3 text-left'}
                            >
                                <span
                                    className={classNames(
                                        'w-2 h-2 rounded-full flex-shrink-0',
                                        d.delivered_at ? 'bg-raptor-400' : d.attempts ? 'bg-rose-400' : 'bg-amber-300'
                                    )}
                                />
                                <span className={'font-mono text-xs text-gray-100 flex-1 truncate'}>{d.event}</span>
                                <span className={'text-xs text-gray-500 tabular-nums'}>
                                    {d.status ?? '—'} · {d.duration_ms ?? 0} ms
                                </span>
                                <span className={'text-xs text-gray-500 w-24 text-right'}>{ago(d.created_at)}</span>
                            </button>
                            {open === d.id && (
                                <div className={'mt-3 space-y-3'}>
                                    {d.error && <Callout tone={'red'}>{d.error}</Callout>}
                                    <Code>{JSON.stringify(d.payload, null, 2)}</Code>
                                    <Button
                                        size={'sm'}
                                        variant={'secondary'}
                                        icon={RefreshIcon}
                                        loading={retry.loading}
                                        onClick={() => retry.run(d.id)}
                                    >
                                        {t('Send again')}
                                    </Button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Drawer>
    );
};

const WebhookRow = ({ hook, onDeliveries }: { hook: Webhook; onDeliveries: () => void }) => {
    const invalidate = [['admin', 'raptor-api']];
    const [deleting, setDeleting] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const toggle = useAction((active: boolean) => updateWebhook(hook.id, { active }), { invalidate });
    const test = useAction(() => testWebhook(hook.id), { success: t('Test event queued'), onSuccess: onDeliveries });
    const rotate = useAction(() => rotateWebhookSecret(hook.id), { onSuccess: (r) => setSecret(r.secret) });
    const remove = useAction(() => deleteWebhook(hook.id), { success: t('Webhook deleted'), invalidate });

    return (
        <li className={'px-4 sm:px-5 py-4'}>
            <div className={'flex flex-wrap items-center gap-3'}>
                <span
                    className={classNames(
                        'w-2.5 h-2.5 rounded-full',
                        !hook.active ? 'bg-gray-600' : hook.failures ? 'bg-rose-400' : 'bg-raptor-400'
                    )}
                />
                <div className={'flex-1 min-w-0'}>
                    <p className={'font-mono text-sm text-gray-100 truncate'}>{hook.url}</p>
                    <p className={'text-xs text-gray-500 truncate'}>
                        {hook.events.length ? hook.events.join(', ') : t('Every event')}
                        {hook.last_delivery_at &&
                            ` · ${t('last delivery {{ago}}', { ago: ago(hook.last_delivery_at) })}`}
                        {!!hook.failures && ` · ${t('{{count}} failed in a row', { count: hook.failures })}`}
                    </p>
                </div>
                <button
                    type={'button'}
                    onClick={() => toggle.run(!hook.active)}
                    className={classNames(
                        'h-7 px-2.5 rounded-full text-xs font-medium ring-1 ring-inset transition-colors',
                        hook.active
                            ? 'bg-raptor-500/10 text-raptor-300 ring-raptor-500/25 hover:bg-raptor-500/20'
                            : 'bg-gray-800 text-gray-400 ring-gray-700 hover:text-gray-200'
                    )}
                >
                    {hook.active ? t('On') : t('Paused')}
                </button>
                <IconButton icon={BeakerIcon} label={t('Send a test event')} onClick={() => test.run()} />
                <IconButton icon={ViewListIcon} label={t('Deliveries')} onClick={onDeliveries} />
                <IconButton icon={KeyIcon} label={t('New secret')} onClick={() => rotate.run()} />
                <IconButton icon={TrashIcon} label={t('Delete')} tone={'danger'} onClick={() => setDeleting(true)} />
            </div>
            {secret && (
                <div className={'mt-3'}>
                    <CopyField label={t('New secret, shown once')} value={secret} mono />
                </div>
            )}
            <Confirm
                open={deleting}
                title={t('Delete this webhook?')}
                confirm={t('Delete')}
                loading={remove.loading}
                onClose={() => setDeleting(false)}
                onConfirm={() => remove.run()}
            >
                {hook.url}
            </Confirm>
        </li>
    );
};

export default () => {
    const { data } = useResource(['admin', 'raptor-api'], (signal) => getRaptorOverview(signal));
    const { data: hooks } = useResource(['admin', 'raptor-api', 'webhooks'], (signal) => getWebhooks(signal));
    const [keyOpen, setKeyOpen] = useState(false);
    const [hookOpen, setHookOpen] = useState(false);
    const [deliveries, setDeliveries] = useState<Webhook | null>(null);

    return (
        <Page
            title={t('Raptor API')}
            icon={LightningBoltIcon}
            description={t(
                'Connect a billing system: it sells your packages, the Panel creates, suspends and deletes the servers.'
            )}
            actions={
                data && (
                    <Button
                        variant={'secondary'}
                        icon={BookOpenIcon}
                        onClick={() => window.open(data.docs_url, '_blank', 'noopener')}
                    >
                        {t('Documentation')}
                    </Button>
                )
            }
        >
            {!data ? (
                <Skeleton className={'h-72 rounded-xl'} />
            ) : (
                <div className={'space-y-6'}>
                    <Card
                        title={t('Connection')}
                        icon={KeyIcon}
                        description={t('Everything the billing module asks for.')}
                        actions={
                            <Button icon={PlusIcon} onClick={() => setKeyOpen(true)}>
                                {t('Create billing key')}
                            </Button>
                        }
                    >
                        <div className={'space-y-4'}>
                            <CopyField label={t('API URL')} value={data.base_url} mono />
                            <div className={'grid gap-3 sm:grid-cols-3'}>
                                {[
                                    [t('Packages'), data.packages, '/admin/packages'],
                                    [t('Webhooks'), data.webhooks, null],
                                    [t('Billing keys'), data.keys.filter((k) => k.billing).length, null],
                                ].map(([label, value, to]) => (
                                    <div
                                        key={label as string}
                                        className={'rounded-lg bg-gray-950/40 ring-1 ring-inset ring-gray-800 p-3'}
                                    >
                                        <p className={'text-[0.65rem] uppercase tracking-wider text-gray-500'}>
                                            {label}
                                        </p>
                                        <p className={'mt-1 text-xl font-semibold text-gray-50 tabular-nums'}>
                                            {to ? (
                                                <Link to={to as string} className={'hover:text-raptor-300'}>
                                                    {value}
                                                </Link>
                                            ) : (
                                                value
                                            )}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {!data.packages && (
                                <Callout tone={'yellow'} title={t('No packages yet')}>
                                    {t(
                                        'Create packages in Admin → Packages first, the billing system orders them by slug.'
                                    )}
                                </Callout>
                            )}
                        </div>
                    </Card>

                    <Card
                        title={t('Quick start')}
                        icon={BookOpenIcon}
                        description={t('One call creates the user and a ready server.')}
                    >
                        <Code>{example(data.base_url)}</Code>
                        <ul className={'mt-4 grid gap-2 sm:grid-cols-2 text-sm text-gray-300'}>
                            {[
                                t('Address everything by your own ids: /servers/ext:order-1042'),
                                t('Sending the same order twice returns the first server'),
                                t('Upgrades are one call: PUT /servers/{id}/package'),
                                t('"Open panel" button: POST /users/{id}/login-link'),
                                t('Hide sold out plans: GET /packages/{slug}/availability'),
                                t('Suspend, unsuspend, reinstall, power and live usage'),
                            ].map((tip) => (
                                <li key={tip} className={'flex gap-2'}>
                                    <span className={'mt-1.5 w-1.5 h-1.5 rounded-full bg-raptor-400 flex-shrink-0'} />
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card
                        flush
                        title={t('Webhooks')}
                        icon={LightningBoltIcon}
                        description={t('Signed with HMAC-SHA256 and retried for about six hours.')}
                        actions={
                            <Button variant={'secondary'} icon={PlusIcon} onClick={() => setHookOpen(true)}>
                                {t('Add webhook')}
                            </Button>
                        }
                    >
                        {!hooks ? (
                            <Skeleton className={'h-20 m-4'} />
                        ) : !hooks.length ? (
                            <EmptyState
                                icon={LightningBoltIcon}
                                title={t('No webhooks')}
                                description={t(
                                    'Your billing system learns about installs, suspensions and deletions as they happen.'
                                )}
                            />
                        ) : (
                            <ul className={'divide-y divide-gray-800 border-t border-gray-800 mt-4'}>
                                {hooks.map((hook) => (
                                    <WebhookRow key={hook.id} hook={hook} onDeliveries={() => setDeliveries(hook)} />
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
            {data && <KeyModal open={keyOpen} onClose={() => setKeyOpen(false)} base={data.base_url} />}
            {data && <WebhookDrawer open={hookOpen} onClose={() => setHookOpen(false)} events={data.events} />}
            <Deliveries hook={deliveries} onClose={() => setDeliveries(null)} />
        </Page>
    );
};
