import React, { useState } from 'react';
import { motion } from 'framer-motion';
import classNames from 'classnames';
import copy from 'copy-to-clipboard';
import {
    CheckCircleIcon,
    ClipboardCopyIcon,
    RefreshIcon,
    TemplateIcon,
    TrashIcon,
    XCircleIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    clearCache,
    FailedJob,
    flushFailedJobs,
    forgetFailedJob,
    getFailedJobs,
    getSystem,
    retryFailedJob,
} from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import { Badge, EmptyState, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { Pagination } from '@/components/admin/ui/DataTable';
import { item } from '@/components/admin/ui/motion';
import { toast } from '@/components/admin/ui/Toast';
import { ago, formatBytes, useAction, useListParams } from '@/components/admin/ui/hooks';

export default () => {
    const { data } = useResource(['admin', 'system'], getSystem);
    const list = useListParams();
    const { data: jobs } = useResource(
        ['admin', 'failed-jobs', list.page],
        (signal) => getFailedJobs({ page: list.page }, signal),
        { keepPrevious: true }
    );
    const [trace, setTrace] = useState<FailedJob | null>(null);
    const [flushing, setFlushing] = useState(false);

    const cache = useAction(clearCache, {
        success: 'Configuration, route and view caches cleared',
        invalidate: [['admin', 'system']],
    });
    const retry = useAction(retryFailedJob, {
        success: 'Job pushed back onto the queue',
        invalidate: [
            ['admin', 'failed-jobs'],
            ['admin', 'system'],
        ],
    });
    const forget = useAction(forgetFailedJob, {
        success: 'Failed job removed',
        invalidate: [
            ['admin', 'failed-jobs'],
            ['admin', 'system'],
        ],
    });
    const flush = useAction(flushFailedJobs, {
        success: 'All failed jobs removed',
        invalidate: [
            ['admin', 'failed-jobs'],
            ['admin', 'system'],
        ],
        onSuccess: () => setFlushing(false),
    });

    const report = data
        ? [
              `Raptor Panel ${data.panel.version} (${data.panel.environment})`,
              `PHP ${data.software.php} · Laravel ${data.software.laravel} · DB ${data.software.database}`,
              `OS ${data.software.os}`,
              `Drivers: ${Object.entries(data.drivers)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(', ')}`,
              `Missing extensions: ${
                  data.extensions
                      .filter((e) => !e.loaded)
                      .map((e) => e.name)
                      .join(', ') || 'none'
              }`,
          ].join('\n')
        : '';

    const passed = data?.checks.filter((check) => check.ok).length || 0;

    return (
        <Page
            title={'System'}
            icon={TemplateIcon}
            description={'Health of the Panel installation, background jobs and caches.'}
            guide={'system'}
            actions={
                <>
                    <Button
                        variant={'secondary'}
                        icon={ClipboardCopyIcon}
                        disabled={!data}
                        onClick={() => {
                            copy(report);
                            toast.success('System report copied', 'Paste it when asking for help.');
                        }}
                    >
                        Copy report
                    </Button>
                    <Button
                        variant={'secondary'}
                        icon={RefreshIcon}
                        loading={cache.loading}
                        onClick={() => cache.run()}
                    >
                        Clear caches
                    </Button>
                </>
            }
        >
            {!data ? (
                <Skeleton className={'h-72 rounded-xl'} />
            ) : (
                <>
                    <div className={'grid gap-6 lg:grid-cols-3'}>
                        <Card
                            title={'Health checks'}
                            description={`${passed} of ${data.checks.length} checks passed`}
                            className={'lg:col-span-2'}
                            actions={
                                <Badge tone={passed === data.checks.length ? 'green' : 'yellow'}>
                                    {Math.round((passed / data.checks.length) * 100)}%
                                </Badge>
                            }
                        >
                            <ul className={'space-y-2'}>
                                {data.checks.map((check, index) => (
                                    <motion.li
                                        key={check.key}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={classNames(
                                            'flex gap-3 rounded-lg p-3 ring-1 ring-inset',
                                            check.ok
                                                ? 'ring-gray-800 bg-gray-950/30'
                                                : 'ring-amber-500/25 bg-amber-500/5'
                                        )}
                                    >
                                        {check.ok ? (
                                            <CheckCircleIcon className={'w-5 h-5 flex-shrink-0 text-raptor-400'} />
                                        ) : (
                                            <XCircleIcon className={'w-5 h-5 flex-shrink-0 text-amber-400'} />
                                        )}
                                        <div className={'min-w-0'}>
                                            <p className={'text-sm font-medium text-gray-100'}>{check.label}</p>
                                            {!check.ok && (
                                                <p className={'mt-0.5 text-xs text-gray-400 leading-relaxed'}>
                                                    {check.hint}
                                                </p>
                                            )}
                                        </div>
                                    </motion.li>
                                ))}
                            </ul>
                        </Card>
                        <div className={'space-y-6'}>
                            <Card title={'Panel'}>
                                <Details
                                    items={[
                                        ['Version', data.panel.version],
                                        ['Environment', data.panel.environment],
                                        ['URL', data.panel.url],
                                        ['Timezone', data.panel.timezone],
                                    ]}
                                />
                                <a
                                    href={data.releases_url}
                                    target={'_blank'}
                                    rel={'noreferrer'}
                                    className={'mt-4 inline-block text-xs text-raptor-300 hover:text-raptor-200'}
                                >
                                    Release notes on GitHub →
                                </a>
                            </Card>
                            <Card title={'Disk'} description={'Free space on the Panel partition'}>
                                <p className={'text-lg font-semibold text-gray-50'}>
                                    {formatBytes(data.disk.free)}{' '}
                                    <span className={'text-xs font-normal text-gray-500'}>
                                        free of {formatBytes(data.disk.total)}
                                    </span>
                                </p>
                                <Meter
                                    value={data.disk.total - data.disk.free}
                                    max={data.disk.total}
                                    className={'mt-2'}
                                />
                            </Card>
                        </div>
                    </div>
                    <div className={'grid gap-6 lg:grid-cols-2'}>
                        <Card title={'Software'}>
                            <Details
                                items={[
                                    ['PHP', data.software.php],
                                    ['Laravel', data.software.laravel],
                                    ['Database', data.software.database],
                                    ['Operating system', data.software.os],
                                    ...Object.entries(data.drivers).map(
                                        ([key, value]) =>
                                            [`${key} driver`, <code key={key}>{value}</code>] as [
                                                string,
                                                React.ReactNode
                                            ]
                                    ),
                                ]}
                            />
                        </Card>
                        <Card title={'PHP extensions'}>
                            <motion.div
                                className={'flex flex-wrap gap-2'}
                                initial={'hidden'}
                                animate={'show'}
                                variants={{ show: { transition: { staggerChildren: 0.03 } } }}
                            >
                                {data.extensions.map((ext) => (
                                    <span key={ext.name}>
                                        <Badge tone={ext.loaded ? 'green' : 'red'} dot>
                                            {ext.name}
                                        </Badge>
                                    </span>
                                ))}
                            </motion.div>
                        </Card>
                    </div>
                </>
            )}
            <Card
                title={'Failed jobs'}
                description={'Background jobs that kept failing after all retries.'}
                flush
                actions={
                    jobs?.meta.total ? (
                        <Button size={'sm'} variant={'danger'} icon={TrashIcon} onClick={() => setFlushing(true)}>
                            Flush all
                        </Button>
                    ) : undefined
                }
            >
                {!jobs ? (
                    <Skeleton className={'h-24 m-5'} />
                ) : jobs.data.length === 0 ? (
                    <EmptyState
                        icon={CheckCircleIcon}
                        title={'No failed jobs'}
                        description={'E-mails and background tasks are being processed normally.'}
                    />
                ) : (
                    <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                        {jobs.data.map((job) => (
                            <li key={job.uuid} className={'flex items-start gap-3 px-5 py-3'}>
                                <button
                                    type={'button'}
                                    onClick={() => setTrace(job)}
                                    className={'flex-1 min-w-0 text-left'}
                                >
                                    <p className={'text-sm font-medium text-gray-100'}>
                                        {job.job}{' '}
                                        <span className={'text-xs font-normal text-gray-500'}>
                                            · {job.queue} · {ago(job.failed_at)}
                                        </span>
                                    </p>
                                    <p className={'mt-0.5 text-xs text-rose-300/90 font-mono truncate'}>
                                        {job.exception}
                                    </p>
                                </button>
                                <IconButton icon={RefreshIcon} label={'Retry'} onClick={() => retry.run(job.uuid)} />
                                <IconButton
                                    icon={TrashIcon}
                                    label={'Forget'}
                                    tone={'danger'}
                                    onClick={() => forget.run(job.uuid)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {jobs && (
                    <Pagination
                        page={jobs.meta.current_page}
                        lastPage={jobs.meta.last_page}
                        total={jobs.meta.total}
                        onChange={list.setPage}
                    />
                )}
            </Card>
            <Drawer
                open={!!trace}
                onClose={() => setTrace(null)}
                wide
                title={trace?.job || ''}
                description={trace ? `Failed ${ago(trace.failed_at)} on the ${trace.queue} queue` : undefined}
            >
                <pre className={'text-xs text-gray-300 font-mono whitespace-pre-wrap break-all'}>{trace?.trace}</pre>
            </Drawer>
            <Confirm
                open={flushing}
                title={'Remove all failed jobs?'}
                confirm={'Flush'}
                loading={flush.loading}
                onConfirm={() => flush.run()}
                onClose={() => setFlushing(false)}
            >
                The jobs are deleted and will not be retried.
            </Confirm>
        </Page>
    );
};
