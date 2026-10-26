import { lazyWithPreload } from '@/lib/lazy';

describe('@/lib/lazy.ts', () => {
    it('only loads the module once', async () => {
        const factory = vi.fn().mockResolvedValue({ default: () => null });
        const Component = lazyWithPreload(factory);

        await Component.preload();
        await Component.preload();

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('allows retrying after a failed load', async () => {
        const factory = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue({ default: () => null });
        const Component = lazyWithPreload(factory);

        await expect(Component.preload()).rejects.toThrow('offline');
        await expect(Component.preload()).resolves.toBeDefined();
        expect(factory).toHaveBeenCalledTimes(2);
    });
});
