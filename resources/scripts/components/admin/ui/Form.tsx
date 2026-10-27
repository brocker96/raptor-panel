import React, { useId } from 'react';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';

const control =
    'block w-full rounded-lg bg-gray-950/60 border-0 ring-1 ring-inset ring-gray-700 text-gray-100 placeholder:text-gray-600 ' +
    'text-base sm:text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-raptor-500 disabled:opacity-60';

const chevron = {
    backgroundImage:
        "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='%239ca3af' d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z'/%3e%3c/svg%3e\")",
    backgroundSize: '1rem',
    backgroundPosition: 'right 0.75rem center',
    appearance: 'none' as const,
};

const errorRing = 'ring-rose-500/70 focus:ring-rose-500';

interface FieldProps {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: string;
    /** Marks the field as required in the label. */
    required?: boolean;
    className?: string;
    children: (id: string, invalid: boolean) => React.ReactNode;
}

export const Field = ({ label, description, error, required, className, children }: FieldProps) => {
    const id = useId();

    return (
        <div className={classNames('min-w-0', className)}>
            {label && (
                <label htmlFor={id} className={'flex items-center gap-1 mb-1.5 text-xs font-medium text-gray-300'}>
                    {label}
                    {required && <span className={'text-raptor-400'}>*</span>}
                </label>
            )}
            {children(id, !!error)}
            <AnimatePresence initial={false}>
                {error ? (
                    <motion.p
                        key={'error'}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={'mt-1.5 text-xs text-rose-300'}
                    >
                        {error}
                    </motion.p>
                ) : (
                    description && <p className={'mt-1.5 text-xs text-gray-500 leading-relaxed'}>{description}</p>
                )}
            </AnimatePresence>
        </div>
    );
};

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: string;
    /** Text rendered inside the input on the right, e.g. "MiB". */
    suffix?: React.ReactNode;
    onChange?: (value: string) => void;
};

export const TextInput = ({
    label,
    description,
    error,
    suffix,
    className,
    onChange,
    required,
    ...props
}: InputProps) => (
    <Field label={label} description={description} error={error} required={required} className={className}>
        {(id, invalid) => (
            <div className={'relative'}>
                <input
                    id={id}
                    className={classNames(control, 'h-10 px-3', { [errorRing]: invalid, 'pr-14': suffix })}
                    onChange={(e) => onChange?.(e.target.value)}
                    aria-invalid={invalid}
                    {...props}
                />
                {suffix && (
                    <span
                        className={
                            'absolute inset-y-0 right-3 flex items-center text-xs text-gray-500 pointer-events-none'
                        }
                    >
                        {suffix}
                    </span>
                )}
            </div>
        )}
    </Field>
);

export const NumberInput = ({
    value,
    onChange,
    ...props
}: Omit<InputProps, 'value' | 'onChange'> & { value: number | null; onChange: (value: number) => void }) => (
    <TextInput
        type={'number'}
        inputMode={'numeric'}
        value={value ?? ''}
        onChange={(v) => onChange(v === '' ? 0 : Number(v))}
        {...props}
    />
);

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: string;
    mono?: boolean;
    onChange?: (value: string) => void;
};

export const TextArea = ({
    label,
    description,
    error,
    mono,
    className,
    onChange,
    required,
    ...props
}: TextAreaProps) => (
    <Field label={label} description={description} error={error} required={required} className={className}>
        {(id, invalid) => (
            <textarea
                id={id}
                className={classNames(control, 'px-3 py-2 min-h-[5rem]', {
                    [errorRing]: invalid,
                    'font-mono text-xs sm:text-xs': mono,
                })}
                onChange={(e) => onChange?.(e.target.value)}
                aria-invalid={invalid}
                spellCheck={!mono}
                {...props}
            />
        )}
    </Field>
);

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: string;
    options: { value: string | number; label: string; disabled?: boolean }[];
    placeholder?: string;
    onChange?: (value: string) => void;
};

export const Select = ({
    label,
    description,
    error,
    options,
    placeholder,
    className,
    onChange,
    required,
    ...props
}: SelectProps) => (
    <Field label={label} description={description} error={error} required={required} className={className}>
        {(id, invalid) => (
            <select
                id={id}
                className={classNames(control, 'h-10 pl-3 pr-9 bg-no-repeat', { [errorRing]: invalid })}
                onChange={(e) => onChange?.(e.target.value)}
                aria-invalid={invalid}
                style={chevron}
                {...props}
            >
                {placeholder !== undefined && <option value={''}>{placeholder}</option>}
                {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                    </option>
                ))}
            </select>
        )}
    </Field>
);

export const Toggle = ({
    label,
    description,
    checked,
    onChange,
    disabled,
}: {
    label: React.ReactNode;
    description?: React.ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) => (
    <label
        className={classNames(
            'flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset ring-gray-800 bg-gray-950/30 cursor-pointer',
            {
                'opacity-60 cursor-not-allowed': disabled,
            }
        )}
    >
        <button
            type={'button'}
            role={'switch'}
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={classNames(
                'relative mt-0.5 inline-flex flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-raptor-400',
                checked ? 'bg-raptor-500' : 'bg-gray-700'
            )}
        >
            <motion.span
                layout
                transition={{ type: 'spring', stiffness: 600, damping: 35 }}
                className={classNames(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow',
                    checked ? 'right-1' : 'left-1'
                )}
            />
        </button>
        <span className={'min-w-0'}>
            <span className={'block text-sm font-medium text-gray-100'}>{label}</span>
            {description && <span className={'block mt-0.5 text-xs text-gray-400 leading-relaxed'}>{description}</span>}
        </span>
    </label>
);

/** Responsive grid for form fields. */
export const FormGrid = ({
    cols = 2,
    className,
    children,
}: {
    cols?: 1 | 2 | 3 | 4;
    className?: string;
    children: React.ReactNode;
}) => (
    <div
        className={classNames(
            'grid grid-cols-1 gap-4',
            {
                'sm:grid-cols-2': cols >= 2,
                'lg:grid-cols-3': cols === 3,
                'lg:grid-cols-4': cols === 4,
            },
            className
        )}
    >
        {children}
    </div>
);
