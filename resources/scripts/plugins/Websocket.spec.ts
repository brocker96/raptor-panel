import { getReconnectDelay, Websocket } from '@/plugins/Websocket';

class FakeSocket {
    static instances: FakeSocket[] = [];
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(public url: string) {
        FakeSocket.instances.push(this);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close(code = 1000) {
        this.readyState = 3;
        this.onclose?.({ code });
    }

    open() {
        this.readyState = 1;
        this.onopen?.();
    }
}

describe('@/plugins/Websocket.ts', () => {
    beforeEach(() => {
        FakeSocket.instances = [];
        vi.useFakeTimers();
        vi.stubGlobal('WebSocket', FakeSocket);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('uses exponential backoff with jitter and a maximum delay', () => {
        expect(getReconnectDelay(0, () => 0)).toBe(500);
        expect(getReconnectDelay(0, () => 1)).toBe(1000);
        expect(getReconnectDelay(3, () => 1)).toBe(8000);
        expect(getReconnectDelay(10, () => 1)).toBe(30_000);
    });

    it('authenticates once connected and parses messages', () => {
        const ws = new Websocket();
        const listener = vi.fn();
        ws.on('console output', listener);

        ws.setToken('token').connect('ws://wings');
        FakeSocket.instances[0].open();
        FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ event: 'console output', args: ['line'] }) });

        expect(JSON.parse(FakeSocket.instances[0].sent[0])).toEqual({ event: 'auth', args: ['token'] });
        expect(listener).toHaveBeenCalledWith('line');
    });

    it('does not send messages before the socket is open', () => {
        const ws = new Websocket().setToken('token').connect('ws://wings');
        ws.send('send logs');

        expect(FakeSocket.instances[0].sent).toHaveLength(0);
    });

    it('reconnects after an unexpected close but not after a suspension', () => {
        const ws = new Websocket().setToken('token').connect('ws://wings');
        FakeSocket.instances[0].open();

        FakeSocket.instances[0].onclose?.({ code: 1006 });
        vi.advanceTimersByTime(1000);
        expect(FakeSocket.instances).toHaveLength(2);

        FakeSocket.instances[1].onclose?.({ code: 4409 });
        vi.advanceTimersByTime(60_000);
        expect(FakeSocket.instances).toHaveLength(2);

        ws.close();
    });

    it('does not reconnect after being closed manually', () => {
        const ws = new Websocket().setToken('token').connect('ws://wings');
        const onClose = vi.fn();
        ws.on('SOCKET_CLOSE', onClose);
        FakeSocket.instances[0].open();

        ws.close();
        vi.advanceTimersByTime(60_000);

        expect(onClose).toHaveBeenCalled();
        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('fetches fresh connection details before reconnecting', async () => {
        const provider = vi.fn().mockResolvedValue({ token: 'fresh', socket: 'ws://wings-new' });
        const ws = new Websocket().setToken('stale').setConnectionProvider(provider).connect('ws://wings');
        FakeSocket.instances[0].open();

        FakeSocket.instances[0].onclose?.({ code: 1006 });
        await vi.advanceTimersByTimeAsync(1000);

        expect(provider).toHaveBeenCalledTimes(1);
        expect(FakeSocket.instances).toHaveLength(2);
        expect(FakeSocket.instances[1].url).toBe('ws://wings-new');

        FakeSocket.instances[1].open();
        expect(JSON.parse(FakeSocket.instances[1].sent[0])).toEqual({ event: 'auth', args: ['fresh'] });

        ws.close();
    });

    it('never opens more than one socket when the network comes back during a reconnect', async () => {
        let resolve: (value: { token: string; socket: string }) => void = () => undefined;
        const provider = vi.fn(() => new Promise<{ token: string; socket: string }>((r) => (resolve = r)));
        const ws = new Websocket().setToken('token').setConnectionProvider(provider).connect('ws://wings');
        FakeSocket.instances[0].open();
        FakeSocket.instances[0].onclose?.({ code: 1006 });

        // Timer fires and starts fetching details, then the network comes back and a manual
        // reconnect is requested while that is still pending.
        await vi.advanceTimersByTimeAsync(1000);
        window.dispatchEvent(new Event('online'));
        ws.open();

        resolve({ token: 'fresh', socket: 'ws://wings' });
        await vi.advanceTimersByTimeAsync(0);

        expect(provider).toHaveBeenCalledTimes(1);
        expect(FakeSocket.instances).toHaveLength(2);

        ws.close();
    });

    it('does not reconnect when closed while fetching connection details', async () => {
        let resolve: (value: { token: string; socket: string }) => void = () => undefined;
        const provider = vi.fn(() => new Promise<{ token: string; socket: string }>((r) => (resolve = r)));
        const ws = new Websocket().setToken('token').setConnectionProvider(provider).connect('ws://wings');
        FakeSocket.instances[0].open();
        FakeSocket.instances[0].onclose?.({ code: 1006 });
        await vi.advanceTimersByTimeAsync(1000);

        ws.close();
        resolve({ token: 'fresh', socket: 'ws://wings' });
        await vi.advanceTimersByTimeAsync(60_000);

        expect(FakeSocket.instances).toHaveLength(1);
    });
});
