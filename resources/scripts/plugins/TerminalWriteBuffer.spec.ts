import TerminalWriteBuffer from '@/plugins/TerminalWriteBuffer';

describe('@/plugins/TerminalWriteBuffer.ts', () => {
    beforeEach(() =>
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    );
    afterEach(() => vi.useRealTimers());

    it('writes all pending lines in a single batch', () => {
        const write = vi.fn();
        const buffer = new TerminalWriteBuffer(write);

        buffer.push('one');
        buffer.push('two');
        expect(write).not.toHaveBeenCalled();

        vi.advanceTimersToNextFrame();
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith('one\r\ntwo\r\n');
    });

    it('only keeps the most recent lines', () => {
        const write = vi.fn();
        const buffer = new TerminalWriteBuffer(write, 2);

        ['a', 'b', 'c'].forEach((line) => buffer.push(line));
        buffer.flush();

        expect(write).toHaveBeenCalledWith('b\r\nc\r\n');
        expect(buffer.pending).toBe(0);
    });

    it('discards pending lines when cleared', () => {
        const write = vi.fn();
        const buffer = new TerminalWriteBuffer(write);

        buffer.push('stale');
        buffer.clear();
        vi.advanceTimersToNextFrame();

        expect(write).not.toHaveBeenCalled();
    });
});
