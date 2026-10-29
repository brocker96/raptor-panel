import React from 'react';
import { Badge } from '@/components/admin/ui/Feedback';
import { TicketCategory, TicketPriority, TicketStatus } from '@/api/support';
import { t } from '@/i18n';

export const statusLabel = (status: TicketStatus, staff = false) =>
    ({
        open: staff ? t('Waiting for staff') : t('Waiting for support'),
        answered: staff ? t('Waiting for user') : t('Answered'),
        closed: t('Closed'),
    }[status]);

export const categoryLabel = (category: TicketCategory) =>
    ({
        general: t('General question'),
        technical: t('Technical problem'),
        billing: t('Billing'),
        abuse: t('Abuse report'),
    }[category]);

export const priorityLabel = (priority: TicketPriority) =>
    ({ low: t('Low'), normal: t('Normal'), high: t('High'), urgent: t('Urgent') }[priority]);

export const StatusBadge = ({ status, staff }: { status: TicketStatus; staff?: boolean }) => {
    // Whoever has to act next sees the ticket highlighted.
    const tone = status === 'closed' ? 'gray' : (status === 'open') === !!staff ? 'yellow' : 'green';

    return (
        <Badge tone={tone} dot={status !== 'closed'}>
            {statusLabel(status, staff)}
        </Badge>
    );
};

export const PriorityBadge = ({ priority }: { priority: TicketPriority }) =>
    priority === 'normal' ? null : (
        <Badge tone={priority === 'low' ? 'gray' : priority === 'high' ? 'yellow' : 'red'}>
            {priorityLabel(priority)}
        </Badge>
    );
