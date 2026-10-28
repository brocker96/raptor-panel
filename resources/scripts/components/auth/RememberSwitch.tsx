import React from 'react';
import classNames from 'classnames';

interface Props {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    children: React.ReactNode;
    className?: string;
}

/** Small labelled switch used on the sign in forms. */
const RememberSwitch = ({ checked, onChange, disabled, children, className }: Props) => (
    <label
        className={classNames(
            'flex items-start gap-3 text-sm text-gray-300 select-none',
            disabled ? 'opacity-60' : 'cursor-pointer',
            className
        )}
    >
        <button
            type={'button'}
            role={'switch'}
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={classNames(
                'relative mt-0.5 inline-flex flex-shrink-0 h-5 w-9 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-raptor-400',
                checked ? 'bg-raptor-500' : 'bg-gray-700'
            )}
        >
            <span
                className={classNames(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    checked && 'translate-x-4'
                )}
            />
        </button>
        <span className={'min-w-0'}>{children}</span>
    </label>
);

export default RememberSwitch;
