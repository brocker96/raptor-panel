import React, { forwardRef } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
    variant?: Variant;
    size?: 'sm' | 'md';
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    loading?: boolean;
    /** Renders the button as a router link. */
    to?: string;
}

const variants: Record<Variant, string> = {
    primary:
        'bg-raptor-500 text-gray-950 hover:bg-raptor-400 active:bg-raptor-600 shadow-[0_0_0_1px_rgb(82_211_33/0.4),0_6px_20px_-8px_rgb(82_211_33/0.6)]',
    secondary: 'bg-gray-800 text-gray-100 ring-1 ring-inset ring-gray-700 hover:bg-gray-700 hover:text-white',
    danger: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30 hover:bg-rose-500 hover:text-white',
    ghost: 'text-gray-300 hover:text-white hover:bg-white/5',
};

export const buttonClass = (variant: Variant = 'primary', size: 'sm' | 'md' = 'md', className?: string) =>
    classNames(
        'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold no-underline select-none',
        'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-raptor-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' ? 'min-h-8 py-1.5 px-3 text-xs' : 'min-h-10 py-2 px-4 text-sm',
        // Translations can be much longer than the English label, the text wraps instead of being cut off.
        'leading-tight text-center',
        variants[variant],
        className
    );

const Spinner = () => (
    <svg className={'w-4 h-4 animate-spin'} viewBox={'0 0 24 24'} fill={'none'} aria-hidden>
        <circle cx={12} cy={12} r={9} stroke={'currentColor'} strokeOpacity={0.25} strokeWidth={3} />
        <path d={'M21 12a9 9 0 0 0-9-9'} stroke={'currentColor'} strokeWidth={3} strokeLinecap={'round'} />
    </svg>
);

const Button = forwardRef<HTMLButtonElement, Props>(
    ({ variant, size, icon: Icon, loading, to, className, children, disabled, type = 'button', ...props }, ref) => {
        const inner = (
            <>
                {loading ? (
                    <Spinner />
                ) : (
                    Icon && <Icon className={classNames(size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                )}
                {children && <span className={'inline-flex items-center gap-1.5 min-w-0 break-words'}>{children}</span>}
            </>
        );

        if (to) {
            return (
                <Link to={to} className={buttonClass(variant, size, className)}>
                    {inner}
                </Link>
            );
        }

        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || loading}
                className={buttonClass(variant, size, className)}
                {...props}
            >
                {inner}
            </button>
        );
    }
);

export default Button;

export const IconButton = ({
    icon: Icon,
    label,
    className,
    tone = 'default',
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: React.ComponentType<React.ComponentProps<'svg'>>;
    label: string;
    tone?: 'default' | 'danger';
}) => (
    <button
        type={'button'}
        aria-label={label}
        title={label}
        className={classNames(
            'inline-grid place-items-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40',
            tone === 'danger'
                ? 'text-gray-400 hover:text-rose-300 hover:bg-rose-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5',
            className
        )}
        {...props}
    >
        <Icon className={'w-4 h-4'} />
    </button>
);
