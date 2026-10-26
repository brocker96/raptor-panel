/**
 * Collects lines written to the terminal and writes them in a single batch once per frame. When a
 * server floods its console (or the full log is sent on connect) this avoids handing thousands of
 * tiny writes to xterm, which keeps the page responsive on slow devices.
 */
export default class TerminalWriteBuffer {
    private lines: string[] = [];
    private frame: number | null = null;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param write   Writes the batched data to the terminal.
     * @param maxLines The maximum number of pending lines kept, older lines are dropped since the
     *                 terminal would immediately scroll them out of its scrollback anyway.
     */
    constructor(private readonly write: (data: string) => void, private readonly maxLines = 5000) {}

    push(line: string) {
        this.lines.push(line);
        if (this.lines.length > this.maxLines) {
            this.lines.splice(0, this.lines.length - this.maxLines);
        }

        this.schedule();
    }

    flush = () => {
        this.cancel();
        if (!this.lines.length) return;

        const data = this.lines.join('\r\n') + '\r\n';
        this.lines = [];
        this.write(data);
    };

    clear() {
        this.cancel();
        this.lines = [];
    }

    get pending(): number {
        return this.lines.length;
    }

    private schedule() {
        if (this.frame !== null || this.timeout !== null) return;

        // Animation frames are paused in background tabs, use a timer there so the buffer is still
        // written out (and kept small) while the console is not visible.
        if (typeof requestAnimationFrame === 'function' && !document.hidden) {
            this.frame = requestAnimationFrame(this.flush);
        } else {
            this.timeout = setTimeout(this.flush, 250);
        }
    }

    private cancel() {
        if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}
