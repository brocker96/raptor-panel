import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GeneratedAvatar, hash, initials } from '@/components/Avatar';

describe('@/components/Avatar', () => {
    it('builds initials from usernames, names and e-mails', () => {
        expect(initials('admin')).toBe('AD');
        expect(initials('John Doe')).toBe('JD');
        expect(initials('raptor_fan-99')).toBe('RF');
        expect(initials('vadym@example.com')).toBe('VA');
        expect(initials('Ölaf')).toBe('ÖL');
        expect(initials('helper7')).toBe('H7');
        expect(initials('')).toBe('?');
    });

    it('is deterministic for the same seed', () => {
        expect(hash('9d2f')).toBe(hash('9d2f'));
        expect(hash('9d2f')).not.toBe(hash('9d2e'));

        const a = renderToStaticMarkup(<GeneratedAvatar name={'admin'} seed={'uuid-1'} />).replace(
            /id="[^"]+"|url\(#[^)]+\)/g,
            ''
        );
        const b = renderToStaticMarkup(<GeneratedAvatar name={'admin'} seed={'uuid-1'} />).replace(
            /id="[^"]+"|url\(#[^)]+\)/g,
            ''
        );
        expect(a).toBe(b);
        expect(a).toContain('>AD</text>');
    });
});
