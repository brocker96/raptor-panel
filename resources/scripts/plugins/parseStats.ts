export interface ServerStats {
    memory_bytes: number;
    memory_limit_bytes: number;
    cpu_absolute: number;
    network: { rx_bytes: number; tx_bytes: number };
    state: string;
    disk_bytes: number;
    uptime: number;
}

let lastRaw: string | null = null;
let lastParsed: ServerStats | null = null;

/**
 * Parses the payload of a "stats" websocket event. Several components listen for the same event
 * every second, so the most recent payload is cached to avoid parsing it once per listener.
 */
export default function parseStats(raw: string): ServerStats | null {
    if (raw === lastRaw) {
        return lastParsed;
    }

    lastRaw = raw;
    try {
        lastParsed = JSON.parse(raw);
    } catch {
        lastParsed = null;
    }

    return lastParsed;
}
