import http from '@/api/http';
import { ListParams, Paginated } from '@/api/admin';

export type TicketStatus = 'open' | 'answered' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'general' | 'technical' | 'billing' | 'abuse';

export interface SupportUser {
    uuid: string;
    username: string;
    name: string;
    avatar_url: string | null;
    admin: boolean;
    email?: string;
}

export interface TicketMessage {
    id: number;
    staff: boolean;
    body: string;
    author: SupportUser | null;
    created_at: string;
}

export interface Ticket {
    id: number;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    server: { uuid: string; identifier: string; name: string } | null;
    user: SupportUser | null;
    assignee: SupportUser | null;
    messages_count: number | null;
    last_message_at: string | null;
    closed_at: string | null;
    created_at: string;
}

export interface TicketThread extends Ticket {
    messages: TicketMessage[];
    staff?: SupportUser[];
}

export interface NewTicket {
    subject: string;
    category: TicketCategory;
    priority: Exclude<TicketPriority, 'urgent'>;
    server: string;
    message: string;
}

const data = <T>(promise: Promise<{ data: T }>) => promise.then((response) => response.data);

// Account area
export const getInbox = (signal?: AbortSignal) =>
    data(http.get<{ tickets: number; staff_tickets: number }>('/api/client/support/inbox', { signal }));
export const getTickets = (signal?: AbortSignal) =>
    data(http.get<{ data: Ticket[] }>('/api/client/support/tickets', { signal })).then((r) => r.data);
export const getTicket = (id: number, signal?: AbortSignal) =>
    data(http.get<TicketThread>(`/api/client/support/tickets/${id}`, { signal }));
export const createTicket = (values: NewTicket) =>
    data(http.post<TicketThread>('/api/client/support/tickets', { ...values, server: values.server || null }));
export const replyToTicket = (id: number, message: string) =>
    data(http.post<TicketMessage>(`/api/client/support/tickets/${id}/messages`, { message }));
export const closeTicket = (id: number) => data(http.post<Ticket>(`/api/client/support/tickets/${id}/close`));

// Admin area
export const getAdminTickets = (params: ListParams, signal?: AbortSignal) =>
    data(http.get<Paginated<Ticket>>('/api/admin/support', { params, signal }));
export const getAdminTicket = (id: number, signal?: AbortSignal) =>
    data(http.get<TicketThread>(`/api/admin/support/${id}`, { signal }));
export const replyAsStaff = (id: number, message: string) =>
    data(http.post<TicketMessage>(`/api/admin/support/${id}/messages`, { message }));
export const updateTicket = (
    id: number,
    values: Partial<{ status: TicketStatus; priority: TicketPriority; assigned_to: string | null }>
) => data(http.patch<TicketThread>(`/api/admin/support/${id}`, values));
