import React from 'react';
import classNames from 'classnames';
import { useStoreState } from '@/state/hooks';

interface Props {
    className?: string;
    /** Only render the icon, without the panel name. */
    iconOnly?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const sizes = {
    sm: { icon: 'w-7 h-7', text: 'text-base' },
    md: { icon: 'w-9 h-9', text: 'text-lg' },
    lg: { icon: 'w-16 h-16', text: 'text-3xl' },
};

/**
 * The Raptor mark followed by the name of the panel. The default name is rendered as the Raptor
 * Panel wordmark, a custom name (configured by an administrator) is shown as is.
 */
export default ({ className, iconOnly, size = 'md' }: Props) => {
    const name = useStoreState((state) => state.settings.data?.name) || 'Raptor Panel';
    const isDefault = name.trim().toLowerCase() === 'raptor panel';

    return (
        <span className={classNames('inline-flex items-center gap-2.5 select-none', className)}>
            <picture className={'flex-shrink-0'}>
                <source srcSet={'/brand/raptor-icon-64.webp 1x, /brand/raptor-icon-128.webp 2x'} type={'image/webp'} />
                <img
                    src={'/brand/raptor-icon-128.png'}
                    alt={''}
                    className={classNames(sizes[size].icon, 'drop-shadow-[0_0_12px_rgb(82_211_33_/_0.35)]')}
                    width={64}
                    height={64}
                />
            </picture>
            {!iconOnly && (
                <span className={classNames(sizes[size].text, 'font-header leading-none tracking-tight truncate')}>
                    {isDefault ? (
                        <>
                            <span className={'font-extrabold text-white'}>RAPTOR</span>
                            <span className={'font-light text-gray-300 ml-1'}>PANEL</span>
                        </>
                    ) : (
                        <span className={'font-bold text-white'}>{name}</span>
                    )}
                </span>
            )}
        </span>
    );
};
