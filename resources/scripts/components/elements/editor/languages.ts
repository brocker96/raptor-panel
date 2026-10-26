import { LanguageDescription } from '@codemirror/language';
import { languages as builtin } from '@codemirror/language-data';

export const PLAIN_TEXT = 'Plain Text';

// Extensions that are extremely common on game servers but are either not matched by the
// default CodeMirror language definitions, or are matched to a less useful language.
const extraExtensions: Record<string, string> = {
    cfg: 'Properties files',
    conf: 'Properties files',
    env: 'Properties files',
    lang: 'Properties files',
    mcmeta: 'JSON',
    json5: 'JSON',
    jsonc: 'JSON',
    hocon: 'Properties files',
    bat: 'Shell',
    cmd: 'Shell',
    vdf: 'JSON',
};

export const languages: readonly LanguageDescription[] = [...builtin].sort((a, b) => a.name.localeCompare(b.name));

export const findLanguageByName = (name: string): LanguageDescription | null =>
    languages.find((lang) => lang.name === name) || null;

export const findLanguageByFilename = (filename: string): LanguageDescription | null => {
    const name = filename.split('/').pop() || '';
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';

    // Exact filename patterns (e.g. "Dockerfile" or "nginx.conf") are the most specific match,
    // followed by the overrides so that e.g. ".cfg" is not detected as an obscure language.
    const byFilename = languages.find((lang) => lang.filename?.test(name));
    if (byFilename) {
        return byFilename;
    }

    if (ext && extraExtensions[ext]) {
        return findLanguageByName(extraExtensions[ext]);
    }

    return LanguageDescription.matchFilename(languages, name);
};
