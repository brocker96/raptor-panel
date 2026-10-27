import React, { useState } from 'react';
import classNames from 'classnames';
import { CheckIcon } from '@heroicons/react/outline';

interface Option {
    id: number;
    label: string;
    hint?: string;
    group?: string;
}

/** Searchable list of checkboxes, used to link mounts to eggs and nodes. */
export default ({
    options,
    selected,
    onChange,
    placeholder = 'Filter…',
}: {
    options: Option[];
    selected: number[];
    onChange: (ids: number[]) => void;
    placeholder?: string;
}) => {
    const [filter, setFilter] = useState('');
    const visible = options.filter((option) =>
        `${option.label} ${option.group || ''}`.toLowerCase().includes(filter.toLowerCase())
    );
    const toggle = (id: number) =>
        onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

    return (
        <div className={'rounded-lg ring-1 ring-inset ring-gray-800 overflow-hidden'}>
            <div className={'flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-950/40'}>
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={placeholder}
                    className={
                        'flex-1 h-8 px-2 rounded-md bg-transparent border-0 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-raptor-500'
                    }
                />
                <span className={'text-2xs text-gray-500 pr-1'}>{selected.length} selected</span>
            </div>
            <ul className={'max-h-72 overflow-y-auto divide-y divide-gray-800/60'}>
                {visible.map((option, index) => (
                    <React.Fragment key={option.id}>
                        {option.group && option.group !== visible[index - 1]?.group && (
                            <li
                                className={
                                    'px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-950/30'
                                }
                            >
                                {option.group}
                            </li>
                        )}
                        <li>
                            <button
                                type={'button'}
                                onClick={() => toggle(option.id)}
                                className={
                                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/[0.03]'
                                }
                            >
                                <span
                                    className={classNames(
                                        'grid place-items-center w-4 h-4 rounded ring-1 ring-inset transition-colors',
                                        selected.includes(option.id)
                                            ? 'bg-raptor-500 ring-raptor-500 text-gray-950'
                                            : 'ring-gray-600'
                                    )}
                                >
                                    {selected.includes(option.id) && <CheckIcon className={'w-3 h-3'} />}
                                </span>
                                <span className={'flex-1 min-w-0 truncate text-gray-200'}>{option.label}</span>
                                {option.hint && <span className={'text-xs text-gray-500'}>{option.hint}</span>}
                            </button>
                        </li>
                    </React.Fragment>
                ))}
                {!visible.length && <li className={'px-3 py-4 text-sm text-gray-500'}>Nothing matches.</li>}
            </ul>
        </div>
    );
};
