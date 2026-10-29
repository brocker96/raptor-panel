import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatAlt2Icon, ChevronRightIcon, PlusIcon, ServerIcon } from '@heroicons/react/outline';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { useResource } from '@/api/query';
import getServers from '@/api/getServers';
import { createTicket, getTickets, NewTicket } from '@/api/support';
import { Card } from '@/components/admin/ui/Card';
import Button from '@/components/admin/ui/Button';
import { EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { FormGrid, Select, TextArea, TextInput } from '@/components/admin/ui/Form';
import { ago, useAction } from '@/components/admin/ui/hooks';
import Modal from '@/components/ui/Modal';
import { categoryLabel, PriorityBadge, StatusBadge } from '@/components/support/meta';
import { t } from '@/i18n';

const blank: NewTicket = { subject: '', category: 'general', priority: 'normal', server: '', message: '' };

const NewTicketModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const navigate = useNavigate();
    const [values, setValues] = useState<NewTicket>(blank);
    const set =
        <K extends keyof NewTicket>(key: K) =>
        (value: string) =>
            setValues((v) => ({ ...v, [key]: value }));
    const { data: servers } = useResource(['support', 'servers'], () => getServers({}), { enabled: open });

    const create = useAction(createTicket, {
        success: t('Your ticket was sent'),
        invalidate: [['support']],
        onSuccess: (ticket) => {
            setValues(blank);
            navigate(`/account/support/${ticket.id}`);
        },
    });

    return (
        <Modal
            open={open}
            onClose={onClose}
            icon={ChatAlt2Icon}
            size={'lg'}
            busy={create.loading}
            title={t('New support ticket')}
            description={t('Describe the problem as precisely as you can, the team usually answers within a day.')}
            footer={
                <>
                    <Button variant={'secondary'} onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        icon={ChatAlt2Icon}
                        loading={create.loading}
                        disabled={values.subject.trim().length < 3 || !values.message.trim()}
                        onClick={() => create.run(values)}
                    >
                        {t('Send ticket')}
                    </Button>
                </>
            }
        >
            <div className={'space-y-4'}>
                <TextInput
                    label={t('Subject')}
                    value={values.subject}
                    onChange={set('subject')}
                    maxLength={150}
                    placeholder={t('For example: the server does not start after an update')}
                    error={create.errors.subject}
                    required
                    autoFocus
                />
                <FormGrid>
                    <Select
                        label={t('Category')}
                        value={values.category}
                        onChange={set('category')}
                        options={(['general', 'technical', 'billing', 'abuse'] as const).map((value) => ({
                            value,
                            label: categoryLabel(value),
                        }))}
                    />
                    <Select
                        label={t('Priority')}
                        value={values.priority}
                        onChange={set('priority')}
                        options={[
                            { value: 'low', label: t('Low') },
                            { value: 'normal', label: t('Normal') },
                            { value: 'high', label: t('High') },
                        ]}
                    />
                </FormGrid>
                <Select
                    label={t('Server')}
                    description={t('Optional, helps the team to find the problem faster.')}
                    value={values.server}
                    onChange={set('server')}
                    placeholder={t('Not about a specific server')}
                    options={(servers?.items || []).map((server) => ({ value: server.uuid, label: server.name }))}
                    error={create.errors.server}
                />
                <TextArea
                    label={t('Message')}
                    value={values.message}
                    onChange={set('message')}
                    rows={6}
                    maxLength={10000}
                    placeholder={t('What happened, what did you expect, and what have you tried already?')}
                    error={create.errors.message}
                    required
                />
            </div>
        </Modal>
    );
};

export default () => {
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);
    const { data: tickets } = useResource(['support', 'tickets'], (signal) => getTickets(signal), {
        refetchInterval: 60_000,
    });

    return (
        <PageContentBlock title={t('Support')}>
            <div className={'mb-6 flex flex-wrap items-end gap-4'}>
                <div className={'flex-1 min-w-0'}>
                    <h1 className={'text-xl sm:text-2xl font-semibold text-gray-50'}>{t('Support')}</h1>
                    <p className={'mt-1 text-sm text-gray-400'}>
                        {t('Ask the team for help. You get an email as soon as somebody answers.')}
                    </p>
                </div>
                <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                    {t('New ticket')}
                </Button>
            </div>
            <Card flush>
                {!tickets ? (
                    <div className={'p-4 space-y-3'}>
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className={'h-14'} />
                        ))}
                    </div>
                ) : !tickets.length ? (
                    <EmptyState
                        icon={ChatAlt2Icon}
                        title={t('No tickets yet')}
                        description={t(
                            'When something does not work as expected, open a ticket and the team will help.'
                        )}
                        action={
                            <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                                {t('New ticket')}
                            </Button>
                        }
                    />
                ) : (
                    <ul className={'divide-y divide-gray-800'}>
                        {tickets.map((ticket) => (
                            <li key={ticket.id}>
                                <button
                                    type={'button'}
                                    onClick={() => navigate(`/account/support/${ticket.id}`)}
                                    className={
                                        'w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors'
                                    }
                                >
                                    <div className={'flex-1 min-w-0'}>
                                        <p className={'flex items-center gap-2 min-w-0'}>
                                            <span className={'font-mono text-xs text-gray-500'}>#{ticket.id}</span>
                                            <span className={'truncate text-sm font-medium text-gray-100'}>
                                                {ticket.subject}
                                            </span>
                                        </p>
                                        <p
                                            className={
                                                'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500'
                                            }
                                        >
                                            <span>{categoryLabel(ticket.category)}</span>
                                            {ticket.server && (
                                                <span className={'inline-flex items-center gap-1'}>
                                                    <ServerIcon className={'w-3.5 h-3.5'} />
                                                    {ticket.server.name}
                                                </span>
                                            )}
                                            <span>{ago(ticket.last_message_at)}</span>
                                        </p>
                                    </div>
                                    <div className={'hidden sm:flex items-center gap-2'}>
                                        <PriorityBadge priority={ticket.priority} />
                                        <StatusBadge status={ticket.status} />
                                    </div>
                                    <span className={'sm:hidden'}>
                                        <StatusBadge status={ticket.status} />
                                    </span>
                                    <ChevronRightIcon className={'w-4 h-4 text-gray-600 flex-shrink-0'} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            <NewTicketModal open={creating} onClose={() => setCreating(false)} />
        </PageContentBlock>
    );
};
