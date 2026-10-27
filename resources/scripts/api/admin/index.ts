import http from '@/api/http';
import { isAxiosError } from 'axios';

/*
 * Typed client for the admin API ("/api/admin") that powers the React admin area. A few write
 * operations (server creation, build, startup and databases) reuse the battle tested application
 * API ("/api/application"), which accepts the same browser session for administrators.
 */

export interface Paginated<T> {
    data: T[];
    meta: { total: number; per_page: number; current_page: number; last_page: number };
}

export interface ListParams {
    page?: number;
    per_page?: number;
    search?: string;
    [key: string]: string | number | undefined;
}

const get = <T>(url: string, params?: object, signal?: AbortSignal) =>
    http.get<T>(url, { params, signal }).then((response) => response.data);

/**
 * Extracts per-field validation messages from an API error response, keyed by the request
 * field ("email", "limits.memory", "app:name" ...).
 */
export const fieldErrors = (error: unknown): Record<string, string> => {
    if (!isAxiosError(error) || error.response?.status !== 422) return {};

    const errors: { detail: string; meta?: { source_field?: string } }[] = error.response.data?.errors || [];

    return errors.reduce<Record<string, string>>((carry, item) => {
        const field = item.meta?.source_field;
        if (field && !carry[field]) carry[field] = item.detail;

        return carry;
    }, {});
};

// ---------------------------------------------------------------------------------------------
// Overview & system
// ---------------------------------------------------------------------------------------------

export interface NodeUsage {
    id: number;
    name: string;
    fqdn: string;
    maintenance_mode: boolean;
    servers: number;
    memory: { used: number; total: number; overallocate: number };
    disk: { used: number; total: number; overallocate: number };
}

export interface Overview {
    counts: Record<
        | 'users'
        | 'admins'
        | 'servers'
        | 'nodes'
        | 'locations'
        | 'nests'
        | 'eggs'
        | 'database_hosts'
        | 'databases'
        | 'mounts'
        | 'failed_jobs',
        number
    >;
    servers: Record<'installed' | 'installing' | 'install_failed' | 'suspended' | 'restoring_backup', number>;
    nodes: NodeUsage[];
    activity: { day: string; total: number }[];
    recent_users: {
        id: number;
        username: string;
        email: string;
        uuid: string;
        root_admin: boolean;
        avatar: string | null;
        created_at: string;
    }[];
    recent_servers: {
        id: number;
        identifier: string;
        name: string;
        node: string | null;
        status: string | null;
        created_at: string;
    }[];
}

export interface SystemInformation {
    panel: { version: string; environment: string; url: string; timezone: string; locale: string; debug: boolean };
    software: { php: string; laravel: string; database: string; os: string };
    drivers: Record<'cache' | 'queue' | 'session' | 'mail' | 'filesystem', string>;
    extensions: { name: string; loaded: boolean }[];
    checks: { key: string; ok: boolean; label: string; hint: string }[];
    disk: { free: number; total: number };
    releases_url: string;
}

export interface FailedJob {
    id: number;
    uuid: string;
    queue: string;
    job: string;
    exception: string;
    trace: string;
    failed_at: string;
}

export const getOverview = (signal?: AbortSignal) => get<Overview>('/api/admin/overview', undefined, signal);
export const getSystem = (signal?: AbortSignal) => get<SystemInformation>('/api/admin/system', undefined, signal);
export const clearCache = () => http.post('/api/admin/system/cache/clear');
export const getFailedJobs = (params: ListParams, signal?: AbortSignal) =>
    get<Paginated<FailedJob>>('/api/admin/system/failed-jobs', params, signal);
export const retryFailedJob = (uuid: string) => http.post(`/api/admin/system/failed-jobs/${uuid}/retry`);
export const forgetFailedJob = (uuid: string) => http.delete(`/api/admin/system/failed-jobs/${uuid}`);
export const flushFailedJobs = () => http.delete('/api/admin/system/failed-jobs');

// ---------------------------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------------------------

export interface AuditEntry {
    id: number;
    event: string;
    ip: string | null;
    description: string | null;
    properties: Record<string, unknown>;
    timestamp: string;
    actor: { type: string; id: number; username?: string; email?: string } | null;
    subjects: { type: string; id: number; label: string | null }[];
}

export const getActivity = (params: ListParams, signal?: AbortSignal) =>
    get<Paginated<AuditEntry>>('/api/admin/activity', params, signal);
export const getActivityEvents = (signal?: AbortSignal) =>
    get<{ data: string[]; subject_types: string[] }>('/api/admin/activity/events', undefined, signal);

// ---------------------------------------------------------------------------------------------
// Settings & API keys
// ---------------------------------------------------------------------------------------------

export interface PanelSettings {
    general: { 'app:name': string; 'app:locale': string; 'raptor:auth:2fa_required': number };
    mail: {
        'mail:mailers:smtp:host': string;
        'mail:mailers:smtp:port': number;
        'mail:mailers:smtp:encryption': string | null;
        'mail:mailers:smtp:username': string | null;
        'mail:from:address': string;
        'mail:from:name': string | null;
    };
    advanced: {
        'recaptcha:enabled': 'true' | 'false';
        'recaptcha:website_key': string;
        'recaptcha:secret_key': string;
        'raptor:guzzle:timeout': number;
        'raptor:guzzle:connect_timeout': number;
        'raptor:client_features:allocations:enabled': 'true' | 'false';
        'raptor:client_features:allocations:range_start': number | null;
        'raptor:client_features:allocations:range_end': number | null;
    };
    meta: {
        languages: Record<string, string>;
        mail_driver: string;
        mail_editable: boolean;
        mail_switchable: boolean;
        mail_password_set: boolean;
        recaptcha_shipped_keys: boolean;
    };
}

export const getSettings = (signal?: AbortSignal) => get<PanelSettings>('/api/admin/settings', undefined, signal);
export const updateSettings = (section: 'general' | 'mail' | 'advanced', values: object) =>
    http.patch(`/api/admin/settings/${section}`, values);
export const updateMailDriver = (driver: 'smtp' | 'log') => http.put('/api/admin/settings/mail/driver', { driver });
export const sendTestMail = () => http.post<{ email: string }>('/api/admin/settings/mail/test').then((r) => r.data);

export interface ApplicationKey {
    identifier: string;
    memo: string | null;
    allowed_ips: string[];
    permissions: Record<string, number>;
    user: { id: number; username: string; email: string } | null;
    last_used_at: string | null;
    created_at: string;
}

export const getApiKeys = (signal?: AbortSignal) =>
    get<{ data: ApplicationKey[]; resources: string[] }>('/api/admin/api-keys', undefined, signal);
export const createApiKey = (values: { memo: string; allowed_ips: string[]; [permission: string]: unknown }) =>
    http.post<{ key: ApplicationKey; token: string }>('/api/admin/api-keys', values).then((r) => r.data);
export const deleteApiKey = (identifier: string) => http.delete(`/api/admin/api-keys/${identifier}`);

// ---------------------------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------------------------

export interface AdminUser {
    id: number;
    uuid: string;
    external_id: string | null;
    username: string;
    email: string;
    name: string;
    root_admin: boolean;
    '2fa': boolean;
    avatar: string | null;
    servers_count: number;
    created_at: string;
}

export interface AdminUserDetails extends AdminUser {
    name_first: string;
    name_last: string;
    language: string;
    servers: { id: number; identifier: string; name: string; status: string | null; node: string | null }[];
    subuser_of: { id: number; identifier: string; name: string }[];
    last_activity: string | null;
}

export interface UserValues {
    email: string;
    username: string;
    name_first: string;
    name_last: string;
    password?: string;
    language?: string;
    root_admin: boolean;
}

export const getUsers = (params: ListParams, signal?: AbortSignal) =>
    get<Paginated<AdminUser>>('/api/admin/users', params, signal);
export const getUser = (id: number, signal?: AbortSignal) =>
    get<AdminUserDetails>(`/api/admin/users/${id}`, undefined, signal);
export const createUser = (values: UserValues) => http.post<AdminUser>('/api/admin/users', values).then((r) => r.data);
export const updateUser = (id: number, values: UserValues) =>
    http.patch<AdminUser>(`/api/admin/users/${id}`, values).then((r) => r.data);
export const deleteUser = (id: number) => http.delete(`/api/admin/users/${id}`);
export const deleteUserAvatar = (id: number) => http.delete(`/api/admin/users/${id}/avatar`);
export const disableUserTwoFactor = (id: number) => http.post(`/api/admin/users/${id}/2fa/disable`);

// ---------------------------------------------------------------------------------------------
// Locations & nodes
// ---------------------------------------------------------------------------------------------

export interface AdminLocation {
    id: number;
    short: string;
    long: string | null;
    nodes: { id: number; name: string }[];
    nodes_count: number;
    servers_count: number;
    created_at: string;
}

export const getLocations = (signal?: AbortSignal) =>
    get<{ data: AdminLocation[] }>('/api/admin/locations', undefined, signal).then((r) => r.data);
export const createLocation = (values: { short: string; long: string }) => http.post('/api/admin/locations', values);
export const updateLocation = (id: number, values: { short: string; long: string }) =>
    http.patch(`/api/admin/locations/${id}`, values);
export const deleteLocation = (id: number) => http.delete(`/api/admin/locations/${id}`);

export interface AdminNode {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    location: { id: number; short: string; long: string | null } | null;
    public: boolean;
    fqdn: string;
    scheme: 'http' | 'https';
    behind_proxy: boolean;
    maintenance_mode: boolean;
    memory: number;
    memory_overallocate: number;
    disk: number;
    disk_overallocate: number;
    upload_size: number;
    daemon_listen: number;
    daemon_sftp: number;
    daemon_base: string;
    usage: { memory: number; disk: number; servers: number };
    created_at: string;
    allocations?: { total: number; assigned: number };
}

export interface NodeValues {
    name: string;
    description: string;
    location_id: number;
    public: boolean;
    fqdn: string;
    scheme: 'http' | 'https';
    behind_proxy: boolean;
    maintenance_mode: boolean;
    memory: number;
    memory_overallocate: number;
    disk: number;
    disk_overallocate: number;
    upload_size: number;
    daemonListen: number;
    daemonSFTP: number;
    daemonBase: string;
    reset_secret?: boolean;
}

export interface NodeAllocation {
    id: number;
    ip: string;
    alias: string | null;
    port: number;
    notes: string | null;
    server: { id: number; name: string; identifier: string } | null;
}

export interface NodeSystem {
    online: boolean;
    error?: string;
    latency?: number;
    version?: string;
    system?: { type: string; arch: string; release: string; cpus: number };
}

export const getNodes = (params: ListParams, signal?: AbortSignal) =>
    get<Paginated<AdminNode>>('/api/admin/nodes', params, signal);
export const getNode = (id: number, signal?: AbortSignal) =>
    get<AdminNode>(`/api/admin/nodes/${id}`, undefined, signal);
export const createNode = (values: NodeValues) =>
    http.post<{ id: number }>('/api/admin/nodes', values).then((r) => r.data);
export const updateNode = (id: number, values: NodeValues) => http.patch(`/api/admin/nodes/${id}`, values);
export const deleteNode = (id: number) => http.delete(`/api/admin/nodes/${id}`);
export const getNodeSystem = (id: number, signal?: AbortSignal) =>
    get<NodeSystem>(`/api/admin/nodes/${id}/system`, undefined, signal);
export const getNodeConfiguration = (id: number, deploy = false, signal?: AbortSignal) =>
    get<{ yaml: string; deploy_command: string | null }>(
        `/api/admin/nodes/${id}/configuration`,
        deploy ? { deploy: 1 } : undefined,
        signal
    );
export const getNodeAllocations = (id: number, params: ListParams, signal?: AbortSignal) =>
    get<Paginated<NodeAllocation> & { ips: string[] }>(`/api/admin/nodes/${id}/allocations`, params, signal);
export const createAllocations = (id: number, values: { ip: string; alias: string; ports: string[] }) =>
    http.post(`/api/admin/nodes/${id}/allocations`, {
        allocation_ip: values.ip,
        allocation_alias: values.alias || null,
        allocation_ports: values.ports,
    });
export const updateAllocationAlias = (node: number, allocation: number, alias: string | null) =>
    http.patch(`/api/admin/nodes/${node}/allocations/${allocation}`, { alias });
export const deleteAllocations = (node: number, target: { ids: number[] } | { ip: string }) =>
    http
        .post<{ deleted: number; skipped: number }>(`/api/admin/nodes/${node}/allocations/delete`, target)
        .then((r) => r.data);

// ---------------------------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------------------------

export interface AdminServer {
    id: number;
    uuid: string;
    identifier: string;
    name: string;
    status: string | null;
    suspended: boolean;
    owner: { id: number; username: string; email: string } | null;
    node: { id: number; name: string } | null;
    egg: { id: number; name: string } | null;
    allocation: { ip: string; alias: string | null; port: number } | null;
    memory: number;
    disk: number;
    cpu: number;
    created_at: string;
}

export interface AdminServerDetails extends AdminServer {
    description: string | null;
    external_id: string | null;
    limits: {
        memory: number;
        swap: number;
        disk: number;
        io: number;
        cpu: number;
        threads: string | null;
        oom_disabled: boolean;
    };
    feature_limits: { databases: number | null; allocations: number | null; backups: number | null };
    container: {
        startup: string;
        image: string;
        skip_scripts: boolean;
        images: Record<string, string>;
        default_startup: string | null;
    };
    nest: { id: number; name: string } | null;
    allocation_id: number;
    allocations: {
        id: number;
        ip: string;
        alias: string | null;
        port: number;
        notes: string | null;
        is_default: boolean;
    }[];
    variables: {
        id: number;
        name: string;
        description: string;
        env_variable: string;
        default_value: string;
        server_value: string | null;
        rules: string;
        user_viewable: boolean;
        user_editable: boolean;
    }[];
    databases: {
        id: number;
        database: string;
        username: string;
        remote: string;
        max_connections: number | null;
        host: { id: number; name: string; address: string } | null;
    }[];
    mounts: { id: number; name: string; source: string; target: string; read_only: boolean; attached: boolean }[];
    transfer: { old_node: number; new_node: number; successful: boolean | null; archived: boolean } | null;
    installed_at: string | null;
    updated_at: string;
}

export interface CreateServerValues {
    name: string;
    description: string;
    external_id?: string;
    user: number;
    egg: number;
    docker_image: string;
    startup: string;
    environment: Record<string, string>;
    skip_scripts: boolean;
    oom_disabled: boolean;
    start_on_completion: boolean;
    limits: { memory: number; swap: number; disk: number; io: number; cpu: number; threads: string | null };
    feature_limits: { databases: number; allocations: number; backups: number };
    allocation: { default: number; additional: number[] };
}

export const getServers = (params: ListParams, signal?: AbortSignal) =>
    get<Paginated<AdminServer>>('/api/admin/servers', params, signal);
export const getServer = (id: number, signal?: AbortSignal) =>
    get<AdminServerDetails>(`/api/admin/servers/${id}`, undefined, signal);
export const createServer = (values: CreateServerValues) =>
    http.post<{ attributes: { id: number } }>('/api/application/servers', values).then((r) => r.data.attributes);
export const updateServerDetails = (
    id: number,
    values: { name: string; user: number; external_id: string | null; description: string }
) => http.patch(`/api/application/servers/${id}/details`, values);
export const updateServerBuild = (
    id: number,
    values: {
        allocation: number;
        oom_disabled: boolean;
        limits: CreateServerValues['limits'];
        feature_limits: CreateServerValues['feature_limits'];
        add_allocations?: number[];
        remove_allocations?: number[];
    }
) => http.patch(`/api/application/servers/${id}/build`, values);
export const updateServerStartup = (
    id: number,
    values: { startup: string; environment: Record<string, string>; egg: number; image: string; skip_scripts: boolean }
) => http.patch(`/api/application/servers/${id}/startup`, values);
export const suspendServer = (id: number, suspend: boolean) =>
    http.post(`/api/application/servers/${id}/${suspend ? 'suspend' : 'unsuspend'}`);
export const reinstallServer = (id: number) => http.post(`/api/application/servers/${id}/reinstall`);
export const toggleServerInstall = (id: number) => http.post(`/api/admin/servers/${id}/toggle-install`);
export const deleteServer = (id: number, force = false) =>
    http.delete(`/api/application/servers/${id}${force ? '/force' : ''}`);
export const transferServer = (
    id: number,
    values: { node_id: number; allocation_id: number; allocation_additional: number[] }
) => http.post(`/api/admin/servers/${id}/transfer`, values);
export const attachServerMount = (id: number, mount: number) =>
    http.post(`/api/admin/servers/${id}/mounts`, { mount_id: mount });
export const detachServerMount = (id: number, mount: number) => http.delete(`/api/admin/servers/${id}/mounts/${mount}`);
export const createServerDatabase = (id: number, values: { database: string; remote: string; host: number }) =>
    http.post(`/api/application/servers/${id}/databases`, values);
export const resetServerDatabasePassword = (id: number, database: number) =>
    http.post(`/api/application/servers/${id}/databases/${database}/reset-password`);
export const deleteServerDatabase = (id: number, database: number) =>
    http.delete(`/api/application/servers/${id}/databases/${database}`);

// ---------------------------------------------------------------------------------------------
// Database hosts & mounts
// ---------------------------------------------------------------------------------------------

export interface DatabaseHost {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
    max_databases: number | null;
    node: { id: number; name: string } | null;
    databases: number;
    created_at: string;
}

export interface DatabaseHostValues {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    node_id: number | null;
}

export const getDatabaseHosts = (signal?: AbortSignal) =>
    get<{ data: DatabaseHost[] }>('/api/admin/database-hosts', undefined, signal).then((r) => r.data);
export const getDatabaseHost = (id: number, signal?: AbortSignal) =>
    get<{
        host: DatabaseHost;
        databases: {
            id: number;
            database: string;
            username: string;
            remote: string;
            max_connections: number | null;
            server: { id: number; name: string; identifier: string } | null;
        }[];
    }>(`/api/admin/database-hosts/${id}`, undefined, signal);
export const createDatabaseHost = (values: DatabaseHostValues) => http.post('/api/admin/database-hosts', values);
export const updateDatabaseHost = (id: number, values: DatabaseHostValues) =>
    http.patch(`/api/admin/database-hosts/${id}`, values);
export const deleteDatabaseHost = (id: number) => http.delete(`/api/admin/database-hosts/${id}`);

export interface AdminMount {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    source: string;
    target: string;
    read_only: boolean;
    user_mountable: boolean;
    counts: { eggs: number; nodes: number; servers: number };
}

export interface AdminMountDetails extends AdminMount {
    eggs: { id: number; name: string; nest: string | null }[];
    nodes: { id: number; name: string }[];
    servers: { id: number; name: string; identifier: string }[];
}

export interface MountValues {
    name: string;
    description: string;
    source: string;
    target: string;
    read_only: boolean;
    user_mountable: boolean;
}

export const getMounts = (signal?: AbortSignal) =>
    get<{ data: AdminMount[] }>('/api/admin/mounts', undefined, signal).then((r) => r.data);
export const getMount = (id: number, signal?: AbortSignal) =>
    get<AdminMountDetails>(`/api/admin/mounts/${id}`, undefined, signal);
export const createMount = (values: MountValues) =>
    http.post<AdminMount>('/api/admin/mounts', values).then((r) => r.data);
export const updateMount = (id: number, values: MountValues) => http.patch(`/api/admin/mounts/${id}`, values);
export const deleteMount = (id: number) => http.delete(`/api/admin/mounts/${id}`);
export const syncMount = (id: number, values: { eggs?: number[]; nodes?: number[] }) =>
    http.put(`/api/admin/mounts/${id}/relations`, values);

// ---------------------------------------------------------------------------------------------
// Nests & eggs
// ---------------------------------------------------------------------------------------------

export interface AdminEggSummary {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    author: string;
    servers: number;
    docker_images: Record<string, string>;
}

export interface AdminNest {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    author: string;
    servers: number;
    eggs: AdminEggSummary[];
}

export interface EggVariable {
    id: number;
    name: string;
    description: string;
    env_variable: string;
    default_value: string;
    user_viewable: boolean;
    user_editable: boolean;
    rules: string;
}

export interface AdminEgg {
    id: number;
    uuid: string;
    nest: { id: number; name: string };
    name: string;
    description: string | null;
    author: string;
    servers: number;
    features: string[];
    file_denylist: string[];
    force_outgoing_ip: boolean;
    docker_images: Record<string, string>;
    startup: string;
    config_from: number | null;
    config_stop: string | null;
    config_startup: string | null;
    config_logs: string | null;
    config_files: string | null;
    script: {
        install: string | null;
        entry: string;
        container: string;
        privileged: boolean;
        copy_from: number | null;
    };
    copy_options: { id: number; name: string; copyable_script: boolean }[];
    variables: EggVariable[];
    created_at: string;
    updated_at: string;
}

export interface EggValues {
    nest_id?: number;
    name: string;
    description: string;
    docker_images: string;
    startup: string;
    features: string[];
    file_denylist: string[];
    force_outgoing_ip: boolean;
    config_from: number | null;
    config_stop: string;
    config_startup: string;
    config_logs: string;
    config_files: string;
}

export interface EggVariableValues {
    name: string;
    description: string;
    env_variable: string;
    default_value: string;
    rules: string;
    options: ('user_viewable' | 'user_editable')[];
}

export const getNests = (signal?: AbortSignal) =>
    get<{ data: AdminNest[] }>('/api/admin/nests', undefined, signal).then((r) => r.data);
export const createNest = (values: { name: string; description: string }) => http.post('/api/admin/nests', values);
export const updateNest = (id: number, values: { name: string; description: string }) =>
    http.patch(`/api/admin/nests/${id}`, values);
export const deleteNest = (id: number) => http.delete(`/api/admin/nests/${id}`);

export const getEgg = (id: number, signal?: AbortSignal) => get<AdminEgg>(`/api/admin/eggs/${id}`, undefined, signal);
export const createEgg = (values: EggValues) => http.post<AdminEgg>('/api/admin/eggs', values).then((r) => r.data);
export const updateEgg = (id: number, values: EggValues) =>
    http.patch<AdminEgg>(`/api/admin/eggs/${id}`, values).then((r) => r.data);
export const deleteEgg = (id: number) => http.delete(`/api/admin/eggs/${id}`);
export const updateEggScript = (
    id: number,
    values: {
        script_install: string;
        script_entry: string;
        script_container: string;
        script_is_privileged: boolean;
        copy_script_from: number | null;
    }
) => http.patch<AdminEgg>(`/api/admin/eggs/${id}/script`, values).then((r) => r.data);
export const exportEgg = (id: number) =>
    http.get<string>(`/api/admin/eggs/${id}/export`, { responseType: 'text' }).then((r) => r.data);

const upload = (url: string, file: File, extra: Record<string, string> = {}) => {
    const form = new FormData();
    form.append('import_file', file);
    Object.entries(extra).forEach(([key, value]) => form.append(key, value));

    return http.post<AdminEgg>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};

export const importEgg = (nest: number, file: File) =>
    upload('/api/admin/eggs/import', file, { import_to_nest: String(nest) });
export const reimportEgg = (id: number, file: File) => upload(`/api/admin/eggs/${id}/import`, file);
export const createEggVariable = (egg: number, values: EggVariableValues) =>
    http.post<EggVariable>(`/api/admin/eggs/${egg}/variables`, values).then((r) => r.data);
export const updateEggVariable = (egg: number, variable: number, values: EggVariableValues) =>
    http.patch<EggVariable>(`/api/admin/eggs/${egg}/variables/${variable}`, values).then((r) => r.data);
export const deleteEggVariable = (egg: number, variable: number) =>
    http.delete(`/api/admin/eggs/${egg}/variables/${variable}`);

// ---------------------------------------------------------------------------------------------
// Cloudflare
// ---------------------------------------------------------------------------------------------

export interface CloudflareStatus {
    settings: { trust_proxies: boolean; websocket_keepalive: boolean };
    ranges: { list: string[]; custom: boolean; updated_at: string | null };
    request: {
        via_cloudflare: boolean;
        connecting_address: string;
        detected_address: string;
        cf_connecting_ip: string | null;
        cf_ray: string | null;
        country: string | null;
        scheme: string;
        secure: boolean;
    };
    panel: { url: string; https: boolean };
    nodes: {
        id: number;
        name: string;
        fqdn: string;
        scheme: string;
        port: number;
        behind_proxy: boolean;
        addresses: string[];
        proxied: boolean;
        issues: { level: 'error' | 'warning'; message: string }[];
    }[];
}

export const getCloudflare = (signal?: AbortSignal) =>
    get<CloudflareStatus>('/api/admin/settings/cloudflare', undefined, signal);
export const updateCloudflare = (values: CloudflareStatus['settings']) =>
    http.patch('/api/admin/settings/cloudflare', values);
export const refreshCloudflareRanges = () =>
    http.post<{ list: string[]; updated_at: string }>('/api/admin/settings/cloudflare/ranges').then((r) => r.data);

/* Updates */

export interface Release {
    version: string;
    tag: string;
    name: string;
    prerelease: boolean;
    published_at: string | null;
    url: string | null;
    notes: string;
    archive: string | null;
    checksum: string | null;
}

export interface UpdateState {
    status: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
    action: 'install' | 'rollback' | null;
    target: string | null;
    step: string | null;
    error: string | null;
    requested_by: string | null;
    requested_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    from: string | null;
    backup: string | null;
}

export interface UpdateBackup {
    id: string;
    version: string;
    created_at: string | null;
    size: number;
    database: boolean;
}

export interface UpdateOverview {
    current: string;
    development: boolean;
    repository: string;
    channel: 'stable' | 'beta';
    auto_check: boolean;
    latest: Release | null;
    update_available: boolean;
    releases: Release[];
    error: string | null;
    state: UpdateState;
    backups: UpdateBackup[];
    php_binary: string;
    base_path: string;
}

export interface UpdateStatus {
    version: string;
    state: UpdateState;
    log: string;
}

export const getUpdates = (refresh: boolean, signal?: AbortSignal) =>
    get<UpdateOverview>('/api/admin/updates', refresh ? { refresh: 1 } : undefined, signal);
export const getUpdateStatus = (signal?: AbortSignal) =>
    get<UpdateStatus>('/api/admin/updates/status', undefined, signal);
export const updateUpdateChannel = (channel: 'stable' | 'beta', autoCheck: boolean) =>
    http.put<UpdateOverview>('/api/admin/updates/channel', { channel, auto_check: autoCheck }).then((r) => r.data);
export const installUpdate = (version: string) =>
    http.post<UpdateStatus>('/api/admin/updates/install', { version }).then((r) => r.data);
export const rollbackUpdate = (backup: string) =>
    http.post<UpdateStatus>('/api/admin/updates/rollback', { backup }).then((r) => r.data);
export const cancelUpdate = () => http.delete('/api/admin/updates/queue');
