import http from '@/api/http';

export interface PackageLimits {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string | null;
    oom_disabled: boolean;
}

export interface ServerPackage {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    active: boolean;
    egg: { id: number; name: string | null; nest_id: number | null };
    image: string | null;
    startup: string | null;
    environment: Record<string, string>;
    limits: PackageLimits;
    feature_limits: { databases: number; allocations: number; backups: number };
    deploy: {
        location_ids: number[];
        node_ids: number[];
        port_range: string[];
        dedicated_ip: boolean;
        start_on_completion: boolean;
    };
    metadata: Record<string, unknown>;
    sort: number;
    servers_count: number | null;
}

/** The flat shape the API takes when creating or updating a package. */
export interface PackageValues {
    slug: string;
    name: string;
    description: string;
    active: boolean;
    egg_id: number;
    image: string;
    startup: string;
    environment: Record<string, string>;
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string;
    oom_disabled: boolean;
    database_limit: number;
    allocation_limit: number;
    backup_limit: number;
    location_ids: number[];
    node_ids: number[];
    port_range: string[];
    dedicated_ip: boolean;
    start_on_completion: boolean;
    sort: number;
}

export const toValues = (p: ServerPackage): PackageValues => ({
    slug: p.slug,
    name: p.name,
    description: p.description || '',
    active: p.active,
    egg_id: p.egg.id,
    image: p.image || '',
    startup: p.startup || '',
    environment: { ...p.environment },
    ...p.limits,
    threads: p.limits.threads || '',
    database_limit: p.feature_limits.databases,
    allocation_limit: p.feature_limits.allocations,
    backup_limit: p.feature_limits.backups,
    ...p.deploy,
    sort: p.sort,
});

const clean = (v: PackageValues) => ({
    ...v,
    image: v.image || null,
    startup: v.startup || null,
    threads: v.threads || null,
    description: v.description || null,
});

export const getPackages = (signal?: AbortSignal) =>
    http.get<{ data: ServerPackage[] }>('/api/admin/packages', { signal }).then((r) => r.data.data);
export const createPackage = (v: PackageValues) =>
    http.post<ServerPackage>('/api/admin/packages', clean(v)).then((r) => r.data);
export const updatePackage = (id: number, v: Partial<PackageValues>) =>
    http
        .patch<ServerPackage>(`/api/admin/packages/${id}`, 'slug' in v ? clean(v as PackageValues) : v)
        .then((r) => r.data);
export const deletePackage = (id: number) => http.delete(`/api/admin/packages/${id}`);
export const duplicatePackage = (id: number) =>
    http.post<ServerPackage>(`/api/admin/packages/${id}/duplicate`).then((r) => r.data);
export const getAvailability = (id: number) =>
    http
        .get<{ available: boolean; reason: string | null }>(`/api/admin/packages/${id}/availability`)
        .then((r) => r.data);

export interface RaptorOverview {
    base_url: string;
    docs_url: string;
    events: string[];
    packages: number;
    webhooks: number;
    keys: { identifier: string; memo: string; billing: boolean; last_used_at: string | null; created_at: string }[];
}

export interface Webhook {
    id: number;
    url: string;
    events: string[];
    description: string | null;
    active: boolean;
    failures: number;
    last_delivery_at: string | null;
    created_at: string;
}

export interface WebhookDelivery {
    id: number;
    uuid: string;
    event: string;
    status: number | null;
    error: string | null;
    attempts: number;
    duration_ms: number | null;
    delivered_at: string | null;
    created_at: string;
    payload: unknown;
}

export type WebhookValues = { url: string; events: string[]; description: string; active: boolean };

export const getRaptorOverview = (signal?: AbortSignal) =>
    http.get<RaptorOverview>('/api/admin/raptor-api', { signal }).then((r) => r.data);
export const createBillingKey = (memo: string, allowed_ips: string[]) =>
    http
        .post<{ identifier: string; token: string }>('/api/admin/raptor-api/keys', { memo, allowed_ips })
        .then((r) => r.data);
export const getWebhooks = (signal?: AbortSignal) =>
    http.get<{ data: Webhook[] }>('/api/admin/raptor-api/webhooks', { signal }).then((r) => r.data.data);
export const createWebhook = (v: WebhookValues) =>
    http.post<Webhook & { secret: string }>('/api/admin/raptor-api/webhooks', v).then((r) => r.data);
export const updateWebhook = (id: number, v: Partial<WebhookValues>) =>
    http.patch<Webhook>(`/api/admin/raptor-api/webhooks/${id}`, v).then((r) => r.data);
export const deleteWebhook = (id: number) => http.delete(`/api/admin/raptor-api/webhooks/${id}`);
export const rotateWebhookSecret = (id: number) =>
    http.post<Webhook & { secret: string }>(`/api/admin/raptor-api/webhooks/${id}/rotate-secret`).then((r) => r.data);
export const testWebhook = (id: number) => http.post(`/api/admin/raptor-api/webhooks/${id}/test`);
export const getDeliveries = (id: number, signal?: AbortSignal) =>
    http
        .get<{ data: WebhookDelivery[] }>(`/api/admin/raptor-api/webhooks/${id}/deliveries`, { signal })
        .then((r) => r.data.data);
export const redeliver = (hook: number, delivery: number) =>
    http.post(`/api/admin/raptor-api/webhooks/${hook}/deliveries/${delivery}/redeliver`);
