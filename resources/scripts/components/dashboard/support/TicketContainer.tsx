import React from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, ServerIcon } from '@heroicons/react/outline';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { useResource } from '@/api/query';
import { closeTicket, getTicket, replyToTicket } from '@/api/support';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { useAction } from '@/components/admin/ui/hooks';
import Thread from '@/components/support/Thread';
import { categoryLabel, PriorityBadge, StatusBadge } from '@/components/support/meta';
import { NotFound } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const {
        data: ticket,
        error,
        mutate,
    } = useResource(['support', 'ticket', id], (signal) => getTicket(id, signal), {
        // New answers show up while the page is open.
        refetchInterval: 15_000,
    });

    const close = useAction(closeTicket, {
        success: t('The ticket was closed'),
        invalidate: [['support']],
    });

    if (error) return <NotFound />;

    return (
        <PageContentBlock title={ticket ? `#${ticket.id} ${ticket.subject}` : t('Support')}>
            <Button variant={'ghost'} size={'sm'} icon={ArrowLeftIcon} to={'/account/support'} className={'mb-4 -ml-2'}>
                {t('All tickets')}
            </Button>
            {!ticket ? (
                <Skeleton className={'h-64'} />
            ) : (
                <div className={'space-y-4'}>
                    <div className={'flex flex-wrap items-start gap-4'}>
                        <div className={'flex-1 min-w-0'}>
                            <h1 className={'text-xl font-semibold text-gray-50 break-words'}>
                                <span className={'font-mono text-gray-500 mr-2'}>#{ticket.id}</span>
                                {ticket.subject}
                            </h1>
                            <p className={'mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500'}>
                                <StatusBadge status={ticket.status} />
                                <PriorityBadge priority={ticket.priority} />
                                <span>{categoryLabel(ticket.category)}</span>
                                {ticket.server && (
                                    <a
                                        href={`/server/${ticket.server.identifier}`}
                                        className={'inline-flex items-center gap-1 hover:text-gray-300'}
                                    >
                                        <ServerIcon className={'w-3.5 h-3.5'} />
                                        {ticket.server.name}
                                    </a>
                                )}
                                {ticket.assignee && (
                                    <span>{t('Handled by {{name}}', { name: ticket.assignee.username })}</span>
                                )}
                            </p>
                        </div>
                        {ticket.status !== 'closed' && (
                            <Button
                                variant={'secondary'}
                                size={'sm'}
                                icon={CheckCircleIcon}
                                loading={close.loading}
                                onClick={() => close.run(ticket.id).then(() => mutate())}
                            >
                                {t('Problem solved')}
                            </Button>
                        )}
                    </div>
                    {ticket.status === 'closed' && (
                        <Callout tone={'green'} icon={CheckCircleIcon}>
                            {t('This ticket is closed. Write a reply to open it again.')}
                        </Callout>
                    )}
                    <Card>
                        <Thread
                            messages={ticket.messages}
                            onSend={(body) => replyToTicket(ticket.id, body).then(() => mutate())}
                        />
                    </Card>
                </div>
            )}
        </PageContentBlock>
    );
};
