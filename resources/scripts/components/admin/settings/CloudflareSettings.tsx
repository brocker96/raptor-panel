import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import classNames from 'classnames';
import {
    BookOpenIcon,
    CheckCircleIcon,
    ChipIcon,
    CloudIcon,
    ExclamationIcon,
    RefreshIcon,
    StatusOnlineIcon,
    XCircleIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getCloudflare, refreshCloudflareRanges, updateCloudflare } from '@/api/admin';
import { Card, Details } from '@/components/admin/ui/Card';
import { Badge, Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import { item } from '@/components/admin/ui/motion';
import { ago, useAction } from '@/components/admin/ui/hooks';
import { useGuide } from '@/components/admin/guides/GuideContext';

export default () => {
    const { data } = useResource(['admin', 'cloudflare'], getCloudflare);
    const { open } = useGuide();
    const [settings, setSettings] = useState({ trust_proxies: true, websocket_keepalive: true });
    const [showRanges, setShowRanges] = useState(false);

    useEffect(() => {
        if (data) setSettings(data.settings);
    }, [data]);

    const save = useAction(() => updateCloudflare(settings), {
        success: 'Cloudflare settings saved',
        invalidate: [['admin', 'cloudflare']],
    });
    const refresh = useAction(refreshCloudflareRanges, {
        success: (r) => `Loaded ${r.list.length} IP ranges from Cloudflare`,
        invalidate: [['admin', 'cloudflare']],
    });

    if (!data) return <Skeleton className={'h-96 rounded-xl'} />;

    const { request } = data;
    const problems = data.nodes.reduce((sum, node) => sum + node.issues.filter((i) => i.level === 'error').length, 0);

    return (
        <div className={'space-y-6'}>
            <motion.div
                variants={item}
                className={classNames(
                    'relative overflow-hidden rounded-xl p-5 ring-1 ring-inset shadow-card',
                    request.via_cloudflare
                        ? 'bg-gradient-to-br from-orange-500/15 via-gray-900 to-gray-900 ring-orange-500/25'
                        : 'bg-gray-900/70 ring-gray-800'
                )}
            >
                <motion.div
                    className={'absolute -right-10 -top-10 w-40 h-40 rounded-full bg-orange-400/20 blur-3xl'}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                />
                <div className={'relative flex flex-col sm:flex-row sm:items-center gap-4'}>
                    <span
                        className={
                            'grid place-items-center w-12 h-12 rounded-xl bg-orange-500/15 ring-1 ring-inset ring-orange-400/30 text-orange-300'
                        }
                    >
                        <CloudIcon className={'w-6 h-6'} />
                    </span>
                    <div className={'flex-1 min-w-0'}>
                        <p className={'text-base font-semibold text-gray-50'}>
                            {request.via_cloudflare
                                ? 'You are connected through Cloudflare'
                                : 'This request did not come through Cloudflare'}
                        </p>
                        <p className={'mt-0.5 text-sm text-gray-400'}>
                            {request.via_cloudflare
                                ? `Ray ${request.cf_ray || 'n/a'}${
                                      request.country ? ` · ${request.country}` : ''
                                  } · the Panel sees your address as ${request.detected_address}.`
                                : `Your address as seen by the Panel is ${request.detected_address}. Nothing to configure if you do not use Cloudflare.`}
                        </p>
                    </div>
                    <Button variant={'secondary'} icon={BookOpenIcon} onClick={() => open('cloudflare')}>
                        Cloudflare guide
                    </Button>
                </div>
            </motion.div>

            {request.via_cloudflare && !data.settings.trust_proxies && (
                <Callout tone={'red'} icon={ExclamationIcon} title={'Cloudflare is not trusted'}>
                    Every visitor appears to come from a Cloudflare address ({request.connecting_address}). Audit logs,
                    rate limits and API key IP restrictions will not work correctly until you enable &quot;Trust
                    Cloudflare&quot; below.
                </Callout>
            )}

            <div className={'grid gap-6 lg:grid-cols-2'}>
                <Card
                    title={'Behaviour'}
                    icon={CloudIcon}
                    footer={
                        <Button loading={save.loading} onClick={() => save.run()}>
                            Save
                        </Button>
                    }
                >
                    <div className={'space-y-3'}>
                        <Toggle
                            label={'Trust Cloudflare'}
                            description={
                                "Read the real visitor IP and HTTPS scheme from requests arriving from Cloudflare's network. Safe to leave on: the headers are only trusted from Cloudflare addresses."
                            }
                            checked={settings.trust_proxies}
                            onChange={(trust_proxies) => setSettings({ ...settings, trust_proxies })}
                        />
                        <Toggle
                            label={'Console keepalive'}
                            description={
                                'Ping the Wings websocket every 25 seconds so Cloudflare (and other proxies) never close an idle console, and replace connections that silently died.'
                            }
                            checked={settings.websocket_keepalive}
                            onChange={(websocket_keepalive) => setSettings({ ...settings, websocket_keepalive })}
                        />
                    </div>
                </Card>
                <Card
                    title={'This request'}
                    icon={StatusOnlineIcon}
                    description={'What the Panel received for the page you are looking at.'}
                >
                    <Details
                        items={[
                            ['Connected from', <code key={'c'}>{request.connecting_address}</code>],
                            ['Detected visitor IP', <code key={'d'}>{request.detected_address}</code>],
                            [
                                'CF-Connecting-IP',
                                request.cf_connecting_ip ? <code key={'cf'}>{request.cf_connecting_ip}</code> : '—',
                            ],
                            [
                                'Scheme',
                                request.secure ? (
                                    <Badge key={'s'} tone={'green'}>
                                        HTTPS
                                    </Badge>
                                ) : (
                                    <Badge key={'s'} tone={'yellow'}>
                                        HTTP
                                    </Badge>
                                ),
                            ],
                            ['Country', request.country],
                            ['Ray ID', request.cf_ray],
                        ]}
                    />
                </Card>
            </div>

            <Card
                title={'Nodes'}
                icon={ChipIcon}
                description={
                    'DNS of every node checked against Cloudflare. Browsers connect to nodes directly for the console, uploads and downloads.'
                }
                actions={
                    problems > 0 ? (
                        <Badge tone={'red'}>{problems} problems</Badge>
                    ) : (
                        <Badge tone={'green'}>All good</Badge>
                    )
                }
                flush
            >
                <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                    {data.nodes.map((node, index) => (
                        <motion.li
                            key={node.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={'px-5 py-4'}
                        >
                            <div className={'flex flex-wrap items-center gap-2'}>
                                <Link
                                    to={`/admin/nodes/${node.id}`}
                                    className={'font-medium text-gray-100 hover:text-white'}
                                >
                                    {node.name}
                                </Link>
                                <code className={'text-xs text-gray-500'}>
                                    {node.scheme}://{node.fqdn}:{node.port}
                                </code>
                                {node.proxied ? (
                                    <Badge tone={'yellow'}>Proxied by Cloudflare</Badge>
                                ) : node.addresses.length ? (
                                    <Badge>DNS only</Badge>
                                ) : null}
                                {node.addresses.length > 0 && (
                                    <span className={'text-2xs text-gray-600 font-mono'}>
                                        {node.addresses.join(', ')}
                                    </span>
                                )}
                            </div>
                            {node.issues.length === 0 ? (
                                <p className={'mt-2 flex items-center gap-1.5 text-xs text-raptor-300'}>
                                    <CheckCircleIcon className={'w-4 h-4'} /> Works with this setup.
                                </p>
                            ) : (
                                <ul className={'mt-2 space-y-1.5'}>
                                    {node.issues.map((issue, i) => (
                                        <li
                                            key={i}
                                            className={classNames(
                                                'flex gap-1.5 text-xs',
                                                issue.level === 'error' ? 'text-rose-300' : 'text-amber-200/90'
                                            )}
                                        >
                                            {issue.level === 'error' ? (
                                                <XCircleIcon className={'w-4 h-4 flex-shrink-0'} />
                                            ) : (
                                                <ExclamationIcon className={'w-4 h-4 flex-shrink-0'} />
                                            )}
                                            {issue.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </motion.li>
                    ))}
                    {!data.nodes.length && <li className={'px-5 py-6 text-sm text-gray-500'}>No nodes yet.</li>}
                </ul>
            </Card>

            <Card
                title={'Cloudflare IP ranges'}
                description={
                    data.ranges.custom
                        ? `${data.ranges.list.length} ranges, refreshed ${ago(data.ranges.updated_at)}.`
                        : `${data.ranges.list.length} built-in ranges. Refresh to load the current list from cloudflare.com.`
                }
                actions={
                    <>
                        <Button size={'sm'} variant={'ghost'} onClick={() => setShowRanges(!showRanges)}>
                            {showRanges ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                            size={'sm'}
                            variant={'secondary'}
                            icon={RefreshIcon}
                            loading={refresh.loading}
                            onClick={() => refresh.run()}
                        >
                            Refresh
                        </Button>
                    </>
                }
            >
                {showRanges ? (
                    <div className={'flex flex-wrap gap-1.5'}>
                        {data.ranges.list.map((range) => (
                            <code key={range} className={'px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300'}>
                                {range}
                            </code>
                        ))}
                    </div>
                ) : (
                    <p className={'text-xs text-gray-500'}>
                        Requests from these networks may set the visitor address. Cloudflare rarely changes them.
                    </p>
                )}
            </Card>
        </div>
    );
};
