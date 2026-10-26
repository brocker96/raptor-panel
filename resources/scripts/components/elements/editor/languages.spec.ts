import { findLanguageByFilename } from '@/components/elements/editor/languages';

describe('@/components/elements/editor/languages.ts', () => {
    it.each([
        ['server.properties', 'Properties files'],
        ['/config/paper-global.yml', 'YAML'],
        ['ops.json', 'JSON'],
        ['plugins/Essentials/config.cfg', 'Properties files'],
        ['start.sh', 'Shell'],
        ['Dockerfile', 'Dockerfile'],
        ['nginx.conf', 'Nginx'],
        ['pack.mcmeta', 'JSON'],
        ['index.ts', 'TypeScript'],
    ])('detects the language for %s', (filename, expected) => {
        expect(findLanguageByFilename(filename)?.name).toBe(expected);
    });

    it('returns null for unknown files', () => {
        expect(findLanguageByFilename('latest.log')).toBeNull();
        expect(findLanguageByFilename('eula')).toBeNull();
    });
});
