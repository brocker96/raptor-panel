import parseStats from '@/plugins/parseStats';

describe('@/plugins/parseStats.ts', () => {
    it('parses and caches the latest payload', () => {
        const raw = JSON.stringify({ cpu_absolute: 12.5, network: { rx_bytes: 1, tx_bytes: 2 } });

        const first = parseStats(raw);
        expect(first?.cpu_absolute).toBe(12.5);
        expect(parseStats(raw)).toBe(first);
        expect(parseStats(JSON.stringify({ cpu_absolute: 1 }))?.cpu_absolute).toBe(1);
    });

    it('returns null for invalid payloads', () => {
        expect(parseStats('{not json')).toBeNull();
    });
});
