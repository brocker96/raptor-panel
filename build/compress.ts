import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|map)$/;

/**
 * Writes pre-compressed Brotli (.br) and gzip (.gz) copies of the built assets so that the web
 * server can serve them directly (nginx `brotli_static` / `gzip_static`) instead of compressing
 * every response on the fly, which is expensive on small VPS instances.
 */
export default function compress({ threshold = 1024 }: { threshold?: number } = {}): Plugin {
    let outDir = '';

    return {
        name: 'raptor:compress',
        apply: 'build',
        configResolved(config) {
            outDir = config.build.outDir;
        },
        async writeBundle(_, bundle) {
            await Promise.all(
                Object.keys(bundle)
                    .filter((file) => COMPRESSIBLE.test(file))
                    .map(async (file) => {
                        const path = join(outDir, file);
                        const source = await fs.readFile(path);
                        if (source.length < threshold) return;

                        const [br, gzipped] = await Promise.all([
                            brotli(source, {
                                params: {
                                    [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
                                    [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
                                },
                            }),
                            gz(source, { level: 9 }),
                        ]);

                        await Promise.all([
                            br.length < source.length ? fs.writeFile(`${path}.br`, br) : null,
                            gzipped.length < source.length ? fs.writeFile(`${path}.gz`, gzipped) : null,
                        ]);
                    })
            );
        },
    };
}
