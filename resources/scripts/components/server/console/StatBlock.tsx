import React from 'react';
import Icon from '@/components/elements/Icon';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import styles from './style.module.css';
import CopyOnClick from '@/components/elements/CopyOnClick';

interface StatBlockProps {
    title: string;
    copyOnClick?: string;
    color?: string | undefined;
    icon: IconDefinition;
    children: React.ReactNode;
    className?: string;
}

const StatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div className={classNames(styles.stat_block, 'bg-gray-600', className)}>
                <div className={classNames(styles.status_bar, color || 'bg-gray-700')} />
                <div className={classNames(styles.icon, color || 'bg-gray-700')}>
                    <Icon
                        icon={icon}
                        className={classNames({
                            'text-gray-100': !color || color === 'bg-gray-700',
                            'text-gray-50': color && color !== 'bg-gray-700',
                        })}
                    />
                </div>
                <div className={classNames(styles.stat_content, 'flex flex-col justify-center overflow-hidden w-full')}>
                    <p className={'font-header font-medium leading-tight text-xs md:text-sm text-gray-200'}>{title}</p>
                    {/* The value scales with the width of the block using container query units, which
                    avoids measuring and re-rendering the text every time the stats update. */}
                    <div className={classNames(styles.stat_value, 'font-semibold text-gray-50 truncate')}>
                        {children}
                    </div>
                </div>
            </div>
        </CopyOnClick>
    );
};

export default React.memo(StatBlock);
