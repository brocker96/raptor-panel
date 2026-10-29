import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChatAlt2Icon, CheckCircleIcon, RefreshIcon } from '@heroicons/react/outline';
import Avatar from '@/components/Avatar';
import { useResource } from '@/api/query';
import { getAdminTicket, replyAsStaff, TicketPriority, TicketStatus, updateTicket } from '@/api/support';
import { Page } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Skeleton } from '@/components/admin/ui/Feedback';
import { Select } from '@/components/admin/ui/Form';
import { ago, useAction } from '@/components/admin/ui/hooks';
import Thread from '@/components/support/Thread';
import { categoryLabel, priorityLabel, statusLabel, StatusBadge } from '@/components/support/meta';
import { t } from '@/i18n';

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const { data: ticket, mutate } = useResource(
        ['admin', 'support', 'ticket', id],
        (signal) => getAdminTicket(id, signal),
        {
            refetchInterval: 15_000,
        }
    );

    const update = useAction((values: Parameters<typeof updateTicket>[1]) => updateTicket(id, values), {
        success: t('Ticket updated'),
        invalidate: [
            ['admin', 'support'],
            ['support', 'inbox'],
        ],
        onSuccess: (thread) => mutate(thread, false),
    });

    return (
        <Page
            title={ticket ? ticket.subject : t('Ticket')}
            icon={ChatAlt2Icon}
            crumbs={[{ label: t('Support'), to: '/admin/support' }, { label: `#${id}` }]}
            actions={
                ticket &&
                (ticket.status === 'closed' ? (
                    <Button
                        variant={'secondary'}
                        icon={RefreshIcon}
                        loading={update.loading}
                        onClick={() => update.run({ status: 'open' })}
                    >
                        {t('Reopen')}
                    </Button>
                ) : (
                    <Button
                        variant={'secondary'}
                        icon={CheckCircleIcon}
                        loading={update.loading}
                        onClick={() => update.run({ status: 'closed' })}
                    >
                        {t('Close ticket')}
                    </Button>
                ))
            }
        >
            {!ticket ? (
                <Skeleton className={'h-80'} />
            ) : (
                <div className={'grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] items-start'}>
                    <Card>
                        <Thread
                            staffView
                            messages={ticket.messages}
                            hint={t('The user gets an email with your answer. Ctrl + Enter to send.')}
                            onSend={(body) =>
                                replyAsStaff(ticket.id, body).then(() => {
                                    mutate();
                                })
                            }
                        />
                    </Card>
                    <div className={'space-y-4 lg:sticky lg:top-20'}>
                        <Card>
                            {ticket.user && (
                                <Link
                                    to={`/admin/users?search=${encodeURIComponent(
                                        ticket.user.email || ticket.user.username
                                    )}`}
                                    className={'flex items-center gap-3 mb-4 group'}
                                >
                                    <span className={'w-10 h-10 rounded-full overflow-hidden'}>
                                        <Avatar
                                            name={ticket.user.username}
                                            seed={ticket.user.uuid}
                                            src={ticket.user.avatar_url}
                                        />
                                    </span>
                                    <span className={'min-w-0'}>
                                        <span
                                            className={
                                                'block text-sm font-medium text-gray-100 truncate group-hover:text-raptor-300'
                                            }
                                        >
                                            {ticket.user.username}
                                        </span>
                                        <span className={'block text-xs text-gray-500 truncate'}>
                                            {ticket.user.email}
                                        </span>
                                    </span>
                                </Link>
                            )}
                            <Details
                                items={[
                                    [t('Status'), <StatusBadge key={'s'} status={ticket.status} staff />],
                                    [t('Category'), categoryLabel(ticket.category)],
                                    [
                                        t('Server'),
                                        ticket.server ? (
                                            <a
                                                key={'srv'}
                                                href={`/server/${ticket.server.identifier}`}
                                                className={'text-raptor-300 hover:underline'}
                                            >
                                                {ticket.server.name}
                                            </a>
                                        ) : (
                                            '—'
                                        ),
                                    ],
                                    [t('Opened'), ago(ticket.created_at)],
                                ]}
                            />
                        </Card>
                        <Card>
                            <div className={'space-y-4'}>
                                <Select
                                    label={t('Status')}
                                    value={ticket.status}
                                    onChange={(status) => update.run({ status: status as TicketStatus })}
                                    options={(['open', 'answered', 'closed'] as const).map((value) => ({
                                        value,
                                        label: statusLabel(value, true),
                                    }))}
                                />
                                <Select
                                    label={t('Priority')}
                                    value={ticket.priority}
                                    onChange={(priority) => update.run({ priority: priority as TicketPriority })}
                                    options={(['low', 'normal', 'high', 'urgent'] as const).map((value) => ({
                                        value,
                                        label: priorityLabel(value),
                                    }))}
                                />
                                <Select
                                    label={t('Assignee')}
                                    value={ticket.assignee?.uuid || ''}
                                    placeholder={t('Nobody')}
                                    onChange={(uuid) => update.run({ assigned_to: uuid || null })}
                                    options={(ticket.staff || []).map((user) => ({
                                        value: user.uuid,
                                        label: user.username,
                                    }))}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </Page>
    );
};
