import React, { Fragment } from 'react';
import classNames from 'classnames';
import { Menu as HMenu, Transition } from '@headlessui/react';
import { DotsHorizontalIcon } from '@heroicons/react/outline';
import { t } from '@/i18n';

export interface MenuItem {
    label: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    hidden?: boolean;
}

/** A "…" button opening a list of actions, used for the actions of a row. */
const Menu = ({
    items,
    label = t('More actions'),
    className,
}: {
    items: MenuItem[];
    label?: string;
    className?: string;
}) => {
    const visible = items.filter((item) => !item.hidden);
    if (!visible.length) return null;

    return (
        <HMenu as={'div'} className={classNames('relative', className)}>
            <HMenu.Button
                aria-label={label}
                title={label}
                className={
                    'grid place-items-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-raptor-500'
                }
            >
                <DotsHorizontalIcon className={'w-5 h-5'} />
            </HMenu.Button>
            <Transition
                as={Fragment}
                enter={'transition ease-out duration-100'}
                enterFrom={'opacity-0 scale-95'}
                enterTo={'opacity-100 scale-100'}
                leave={'transition ease-in duration-75'}
                leaveFrom={'opacity-100 scale-100'}
                leaveTo={'opacity-0 scale-95'}
            >
                <HMenu.Items
                    className={
                        'absolute right-0 z-30 mt-1 w-52 origin-top-right rounded-xl bg-gray-900 p-1 shadow-2xl ring-1 ring-gray-700 focus:outline-none'
                    }
                >
                    {visible.map((item, i) => (
                        <HMenu.Item key={i} disabled={item.disabled}>
                            {({ active, disabled }) => (
                                <button
                                    type={'button'}
                                    onClick={item.onClick}
                                    className={classNames(
                                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm',
                                        disabled && 'opacity-40 cursor-not-allowed',
                                        item.danger
                                            ? active
                                                ? 'bg-rose-500/15 text-rose-200'
                                                : 'text-rose-300'
                                            : active
                                            ? 'bg-white/5 text-gray-50'
                                            : 'text-gray-200'
                                    )}
                                >
                                    {item.icon && <item.icon className={'w-4 h-4 flex-shrink-0 opacity-80'} />}
                                    {item.label}
                                </button>
                            )}
                        </HMenu.Item>
                    ))}
                </HMenu.Items>
            </Transition>
        </HMenu>
    );
};

export default Menu;
