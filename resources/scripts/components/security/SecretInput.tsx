import React, { forwardRef } from 'react';
import classNames from 'classnames';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    kind: 'pin' | 'password' | 'totp';
    onChange: (value: string) => void;
}

/**
 * Input for PINs, passwords and two-factor codes. PINs and codes only accept digits and are
 * rendered large and spaced out so they are easy to type on a phone.
 */
const SecretInput = forwardRef<HTMLInputElement, Props>(({ kind, onChange, className, ...props }, ref) => (
    <input
        ref={ref}
        type={kind === 'totp' ? 'text' : 'password'}
        inputMode={kind === 'password' ? undefined : 'numeric'}
        autoComplete={kind === 'password' ? 'current-password' : kind === 'totp' ? 'one-time-code' : 'off'}
        maxLength={kind === 'pin' ? 8 : kind === 'totp' ? 6 : undefined}
        onChange={(e) => onChange(kind === 'password' ? e.target.value : e.target.value.replace(/\D/g, ''))}
        className={classNames(
            'block w-full h-12 px-4 rounded-xl bg-gray-950/70 border-0 ring-1 ring-inset ring-gray-700 text-gray-50',
            'placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500 transition-shadow',
            kind === 'password'
                ? 'text-base'
                : 'text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-base',
            className
        )}
        {...props}
    />
));

SecretInput.displayName = 'SecretInput';

export default SecretInput;
