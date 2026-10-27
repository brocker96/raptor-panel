import React, { useId, useState } from 'react';
import classNames from 'classnames';
import { useStoreState } from '@/state/hooks';

// Gradient pairs that sit well on the graphite background of the panel, mostly greens and teals
// around the raptor brand color with a few accents so that avatars remain distinguishable.
const palettes: [string, string][] = [
    ['#6fe33f', '#1c5a0d'],
    ['#34d399', '#064e3b'],
    ['#2dd4bf', '#134e4a'],
    ['#a3e635', '#365314'],
    ['#22d3ee', '#164e63'],
    ['#4ade80', '#14532d'],
    ['#fbbf24', '#78350f'],
    ['#38bdf8', '#0c4a6e'],
    ['#f472b6', '#831843'],
    ['#c084fc', '#4c1d95'],
];

/** FNV-1a, a tiny and well distributed string hash. */
export const hash = (value: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }

    return h >>> 0;
};

export const initials = (name: string): string => {
    const parts = name
        .replace(/@.*$/, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);

    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();

    // "helper7" becomes "H7" so that numbered accounts remain distinguishable.
    const numbered = /^(\p{L})\p{L}*(\p{N})\p{N}*$/u.exec(parts[0] || '');
    if (numbered) return (numbered[1] + numbered[2]).toUpperCase();

    return (parts[0] || '?').slice(0, 2).toUpperCase();
};

interface GeneratedProps {
    name: string;
    /** Stable value the colors and shapes are derived from, usually the user UUID. */
    seed?: string;
    className?: string;
}

/**
 * Generated avatar in the style of the panel: a two tone gradient with angular "scale" facets and
 * the initials of the user. Everything is derived from the seed so it never changes for a user.
 */
export const GeneratedAvatar = ({ name, seed, className }: GeneratedProps) => {
    const id = useId().replace(/:/g, '');
    const h = hash(seed || name);
    const [from, to] = palettes[h % palettes.length];
    const angle = (h >>> 4) % 360;
    const shift = ((h >>> 12) % 24) - 12;
    const spin = (h >>> 20) % 3;

    return (
        <svg
            viewBox={'0 0 64 64'}
            className={classNames('block w-full h-full', className)}
            role={'img'}
            aria-label={name}
        >
            <defs>
                <linearGradient id={`g${id}`} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
                    <stop offset={'0%'} stopColor={from} />
                    <stop offset={'100%'} stopColor={to} />
                </linearGradient>
                <radialGradient id={`s${id}`} cx={'30%'} cy={'20%'} r={'80%'}>
                    <stop offset={'0%'} stopColor={'#fff'} stopOpacity={0.28} />
                    <stop offset={'60%'} stopColor={'#fff'} stopOpacity={0} />
                </radialGradient>
            </defs>
            <rect width={64} height={64} fill={`url(#g${id})`} />
            <g transform={`rotate(${spin * 120} 32 32)`} fill={'#000'}>
                <path d={`M0 ${44 + shift / 2} L${30 + shift} 64 L0 64 Z`} opacity={0.22} />
                <path d={`M64 ${8 + shift} L64 ${40 - shift / 2} L${38 - shift / 2} 64 L64 64 Z`} opacity={0.16} />
                <path
                    d={`M${18 + shift} 0 L${46 + shift / 2} 0 L${32 + shift} ${16 + shift / 3} Z`}
                    opacity={0.12}
                    fill={'#fff'}
                />
            </g>
            <rect width={64} height={64} fill={`url(#s${id})`} />
            <text
                x={'50%'}
                y={'50%'}
                dy={'0.35em'}
                textAnchor={'middle'}
                fill={'#fff'}
                fontFamily={'"Inter Variable", Inter, system-ui, sans-serif'}
                fontWeight={650}
                fontSize={24}
                letterSpacing={'-0.02em'}
                style={{ paintOrder: 'stroke', stroke: 'rgb(0 0 0 / 0.18)', strokeWidth: 2 }}
            >
                {initials(name)}
            </text>
        </svg>
    );
};

interface AvatarProps extends GeneratedProps {
    /** URL of an uploaded photo, the generated avatar is shown when it is missing or fails to load. */
    src?: string | null;
}

const Avatar = ({ src, name, seed, className }: AvatarProps) => {
    const [failed, setFailed] = useState<string | null>(null);

    if (src && failed !== src) {
        return (
            <img
                src={src}
                alt={name}
                loading={'lazy'}
                onError={() => setFailed(src)}
                className={classNames('block w-full h-full object-cover', className)}
            />
        );
    }

    return <GeneratedAvatar name={name} seed={seed} className={className} />;
};

/** Avatar of the currently logged in user. */
const UserAvatar = ({ className }: { className?: string }) => {
    const user = useStoreState((state) => state.user.data);

    return <Avatar name={user?.username || 'system'} seed={user?.uuid} src={user?.avatarUrl} className={className} />;
};

Avatar.displayName = 'Avatar';
UserAvatar.displayName = 'Avatar.User';

export default Object.assign(Avatar, { User: UserAvatar });
