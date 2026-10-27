import { EventEmitter } from 'eventemitter3';

// Close codes that should never trigger a reconnect: normal closures, and the codes returned by
// Wings when a server is suspended (4409) or reserved for future use (4400).
const NO_RECONNECT_CODES = [1000, 1001, 1005, 4400, 4409];

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30_000;
const MAX_ATTEMPTS = 20;

// Proxies such as Cloudflare close websockets that have been idle for ~100 seconds. A server that is
// offline does not produce any output, so a cheap "send stats" request is sent whenever the socket
// has been quiet for a while. If even that gets no answer the connection is considered dead (a
// half-open TCP connection through a proxy never fires "close") and is replaced.
export const KEEPALIVE_INTERVAL = 25_000;
export const DEAD_AFTER = 70_000;

export interface ConnectionDetails {
    token: string;
    socket: string;
}

/**
 * Returns the delay before the given reconnect attempt using exponential backoff with jitter, so
 * that a node restart does not result in every open browser reconnecting at the exact same time.
 */
export const getReconnectDelay = (attempt: number, random = Math.random): number => {
    const base = Math.min(MAX_RECONNECT_DELAY, MIN_RECONNECT_DELAY * 2 ** attempt);

    return Math.round(base / 2 + random() * (base / 2));
};

export class Websocket extends EventEmitter {
    // The socket instance being tracked.
    private socket: WebSocket | null = null;

    // The URL being connected to for the socket.
    private url: string | null = null;

    // The authentication token passed along with every request to the Daemon.
    // By default this token expires every 15 minutes and must therefore be
    // refreshed at a pretty continuous interval. The socket server will respond
    // with "token expiring" and "token expired" events when approaching 3 minutes
    // and 0 minutes to expiry.
    private token = '';

    private attempts = 0;
    private lastMessageAt = 0;
    private authenticated = false;
    private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Set while a reconnect attempt is fetching fresh connection details, so that the timer, the
    // "online" event and manual calls can never start more than one connection at the same time.
    private reconnecting = false;

    // Bumped whenever the connection is closed on purpose, a pending reconnect attempt started
    // before that will notice and abort instead of opening a new socket.
    private generation = 0;

    // Returns fresh connection details (token and socket URL). Tokens are short lived, so they are
    // re-fetched before every reconnect rather than re-using a token that may have expired while
    // the connection was down.
    private provider: (() => Promise<ConnectionDetails>) | null = null;

    // Reconnect right away when the browser comes back online instead of waiting for the backoff.
    private onOnline = () => {
        if (this.reconnectTimer && this.url) {
            this.clearReconnectTimer();
            this.reconnectNow();
        }
    };

    // Can be turned off in Settings → Cloudflare for setups where every message counts.
    private keepalive = true;

    setKeepalive(enabled: boolean): this {
        this.keepalive = enabled;

        return this;
    }

    setConnectionProvider(provider: () => Promise<ConnectionDetails>): this {
        this.provider = provider;

        return this;
    }

    // Connects to the websocket instance and sets the token for the initial request.
    connect(url: string): this {
        this.url = url;
        this.attempts = 0;
        window.addEventListener('online', this.onOnline);
        this.open();

        return this;
    }

    // Sets the authentication token to use when sending commands back and forth
    // between the websocket instance.
    setToken(token: string, isUpdate = false): this {
        this.token = token;

        if (isUpdate) {
            this.authenticate();
        }

        return this;
    }

    authenticate() {
        if (this.url && this.token) {
            this.send('auth', this.token);
        }
    }

    close(code = 1000, reason?: string) {
        this.url = null;
        this.token = '';
        this.generation++;
        this.clearReconnectTimer();
        window.removeEventListener('online', this.onOnline);

        // The close handler still runs (emitting SOCKET_CLOSE), but will not reconnect since the URL
        // has been cleared.
        this.socket?.close(code, reason);
    }

    open() {
        if (!this.url) return;

        // Never create a second socket while one is already open or connecting.
        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        this.detach();

        const socket = new WebSocket(this.url);
        this.socket = socket;

        socket.onmessage = (e) => {
            this.lastMessageAt = Date.now();
            try {
                const { event, args } = JSON.parse(e.data);
                if (event === 'auth success') this.authenticated = true;
                args ? this.emit(event, ...args) : this.emit(event);
            } catch (ex) {
                console.warn('Failed to parse incoming websocket message.', ex);
            }
        };

        socket.onopen = () => {
            this.attempts = 0;
            this.lastMessageAt = Date.now();
            this.startKeepalive(socket);
            this.emit('SOCKET_OPEN');
            this.authenticate();
        };

        socket.onerror = (error) => this.emit('SOCKET_ERROR', error);

        socket.onclose = (e) => {
            // Ignore events from sockets that have since been replaced or closed on purpose.
            if (this.socket !== socket) return;

            // This socket is done, forget it so that a reconnect is free to open a new one.
            this.socket = null;
            this.stopKeepalive();
            this.emit('SOCKET_CLOSE');

            if (this.url && !NO_RECONNECT_CODES.includes(e.code)) {
                this.scheduleReconnect();
            }
        };
    }

    reconnect() {
        this.clearReconnectTimer();
        this.detach();
        this.reconnectNow();
    }

    send(event: string, payload?: string | string[]) {
        // Messages sent while (re)connecting would throw, they are re-sent after authenticating.
        if (this.socket?.readyState !== WebSocket.OPEN) return;

        this.socket.send(JSON.stringify({ event, args: Array.isArray(payload) ? payload : [payload] }));
    }

    private scheduleReconnect() {
        if (!this.url) return;

        if (this.attempts >= MAX_ATTEMPTS) {
            this.emit('SOCKET_CONNECT_ERROR');
            return;
        }

        this.emit('SOCKET_RECONNECT');
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectNow();
        }, getReconnectDelay(this.attempts++));
    }

    private async reconnectNow() {
        if (this.reconnecting || !this.url) return;

        this.reconnecting = true;
        const generation = this.generation;

        try {
            if (this.provider) {
                const details = await this.provider();

                // The connection was closed on purpose while the details were being fetched.
                if (generation !== this.generation || !this.url) return;

                this.url = details.socket;
                this.token = details.token;
            }

            this.open();
        } catch (error) {
            console.warn('Failed to fetch websocket connection details, retrying.', error);
            if (generation === this.generation) {
                this.scheduleReconnect();
            }
        } finally {
            this.reconnecting = false;
        }
    }

    private startKeepalive(socket: WebSocket) {
        this.stopKeepalive();

        this.keepaliveTimer = setInterval(() => {
            if (this.socket !== socket || socket.readyState !== WebSocket.OPEN) return;

            const idle = Date.now() - this.lastMessageAt;
            // Without keepalives an idle but healthy connection is indistinguishable from a dead one.
            if (this.keepalive && idle >= DEAD_AFTER) {
                // Nothing came back, not even an answer to the keepalive: replace the connection.
                this.detach();
                this.emit('SOCKET_CLOSE');
                this.scheduleReconnect();
            } else if (this.keepalive && this.authenticated && idle >= KEEPALIVE_INTERVAL) {
                this.send('send stats');
            }
        }, 5_000);
    }

    private stopKeepalive() {
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
        this.authenticated = false;
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // Removes the handlers from the current socket so that it can be replaced.
    private detach() {
        const socket = this.socket;
        if (!socket) return;

        this.socket = null;
        this.stopKeepalive();
        socket.onmessage = socket.onopen = socket.onerror = socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000);
        }
    }
}
