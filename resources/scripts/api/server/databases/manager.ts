import http from '@/api/http';

export interface DbTable {
    name: string;
    view: boolean;
    engine: string | null;
    rows: number | null;
    size: number;
    collation: string | null;
    comment: string;
    updated_at: string | null;
}

export interface DbOverview {
    name: string;
    version: string;
    charset: string;
    collation: string;
    size: number;
    tables: DbTable[];
}

export interface DbColumn {
    name: string;
    type: string;
    data_type: string;
    nullable: boolean;
    default: string | null;
    key: string;
    extra: string;
    comment: string;
    auto_increment: boolean;
    binary: boolean;
}

export interface DbStructure {
    name: string;
    columns: DbColumn[];
    primary: string[];
    indexes: { name: string; unique: boolean; primary: boolean; type: string; columns: string[] }[];
    foreign_keys: { name: string; column: string; table: string; references: string }[];
    create: string;
}

/** A cell value, binary values are replaced by their length. */
export type DbValue = string | number | boolean | null | { $binary: number };

export interface DbFilter {
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'null' | 'not_null';
    value?: string;
}

export interface DbRowsQuery {
    page: number;
    per_page: number;
    sort?: string;
    direction?: 'asc' | 'desc';
    search?: string;
    filters?: DbFilter[];
}

export interface DbRows {
    columns: DbColumn[];
    primary: string[];
    rows: DbValue[][];
    truncated: [number, number][];
    pagination: { total: number; per_page: number; current_page: number; total_pages: number };
}

export interface DbQueryResult {
    sql: string;
    time?: number;
    affected?: number;
    columns?: { name: string; table: string | null; type: string; binary: boolean }[];
    rows?: DbValue[][];
    limited?: boolean;
    error?: string;
    code?: number | null;
}

export interface DbImportResult {
    executed: number;
    time: number;
    error: string | null;
    statement?: string;
}

const base = (uuid: string, database: string) => `/api/client/servers/${uuid}/databases/${database}/manager`;
const table = (uuid: string, database: string, name: string) =>
    `${base(uuid, database)}/tables/${encodeURIComponent(name)}`;

export const getOverview = (uuid: string, database: string): Promise<DbOverview> =>
    http.get(base(uuid, database)).then(({ data }) => data);

export const getStructure = (uuid: string, database: string, name: string): Promise<DbStructure> =>
    http.get(table(uuid, database, name)).then(({ data }) => data);

export const getRows = (uuid: string, database: string, name: string, query: DbRowsQuery): Promise<DbRows> =>
    http.get(`${table(uuid, database, name)}/rows`, { params: query }).then(({ data }) => data);

export const insertRow = (uuid: string, database: string, name: string, values: Record<string, unknown>) =>
    http.post(`${table(uuid, database, name)}/rows`, { values }).then(({ data }) => data as { id: number });

export const updateRow = (
    uuid: string,
    database: string,
    name: string,
    key: Record<string, unknown>,
    values: Record<string, unknown>
) =>
    http.patch(`${table(uuid, database, name)}/rows`, { key, values }).then(({ data }) => data as { affected: number });

export const deleteRows = (uuid: string, database: string, name: string, keys: Record<string, unknown>[]) =>
    http.post(`${table(uuid, database, name)}/rows/delete`, { keys }).then(({ data }) => data as { deleted: number });

export const truncateTable = (uuid: string, database: string, name: string) =>
    http.post(`${table(uuid, database, name)}/truncate`);

export const dropTable = (uuid: string, database: string, name: string) => http.delete(table(uuid, database, name));

export const runQuery = (uuid: string, database: string, sql: string): Promise<DbQueryResult[]> =>
    http.post(`${base(uuid, database)}/query`, { sql }, { timeout: 120000 }).then(({ data }) => data.results);

export const importSql = (uuid: string, database: string, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);

    return http
        .post(`${base(uuid, database)}/import`, form, {
            timeout: 0,
            onUploadProgress: (event) => event.total && onProgress?.(Math.round((event.loaded / event.total) * 100)),
        })
        .then(({ data }) => data as DbImportResult);
};

/** Downloads a SQL dump and hands it to the browser as a file. */
export const exportSql = async (uuid: string, database: string, tables: string[], data: boolean) => {
    const response = await http.get(`${base(uuid, database)}/export`, {
        params: { tables, data: data ? 1 : 0 },
        responseType: 'blob',
        timeout: 0,
    });

    const name = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')?.[1] || `${database}.sql`;
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
