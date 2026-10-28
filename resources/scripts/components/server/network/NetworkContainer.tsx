import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import isEqual from 'react-fast-compare';
import { CheckIcon, GlobeAltIcon, PlusIcon, StarIcon, TrashIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { Allocation } from '@/api/server/getServer';
import getServerAllocations from '@/api/swr/getServerAllocations';
import createServerAllocation from '@/api/server/network/createServerAllocation';
import deleteServerAllocation from '@/api/server/network/deleteServerAllocation';
import setPrimaryServerAllocation from '@/api/server/network/setPrimaryServerAllocation';
import setServerAllocationNotes from '@/api/server/network/setServerAllocationNotes';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import { usePermissions } from '@/plugins/usePermissions';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useCopy } from '@/components/ui/CopyField';
import Menu from '@/components/ui/Menu';
import Button from '@/components/admin/ui/Button';
import { Callout, Meter, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import { toast } from '@/components/admin/ui/Toast';
import { ip } from '@/lib/formatters';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const address = (allocation: Allocation) => `${allocation.alias || ip(allocation.ip)}:${allocation.port}`;

const CopyAddress = ({ allocation, large }: { allocation: Allocation; large?: boolean }) => {
    const { copied, copy } = useCopy();

    return (
        <button
            type={'button'}
            onClick={() => copy(address(allocation))}
            title={t('Copy')}
            className={classNames(
                'group inline-flex items-center gap-2 font-mono text-left break-all',
                large ? 'text-xl sm:text-2xl text-gray-50' : 'text-sm text-gray-100'
            )}
        >
            {address(allocation)}
            <span
                className={classNames(
                    'text-xs font-sans',
                    copied ? 'text-raptor-400' : 'text-gray-600 group-hover:text-gray-300'
                )}
            >
                {copied ? <CheckIcon className={'w-4 h-4'} /> : t('copy')}
            </span>
        </button>
    );
};

const Notes = ({ allocation, editable }: { allocation: Allocation; editable: boolean }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = getServerAllocations();
    const [value, setValue] = useState(allocation.notes || '');
    const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => setValue(allocation.notes || ''), [allocation.notes]);

    const save = async () => {
        if (value === (allocation.notes || '')) return;
        setState('saving');
        try {
            await setServerAllocationNotes(uuid, allocation.id, value);
            await mutate((data) => data?.map((a) => (a.id === allocation.id ? { ...a, notes: value } : a)), false);
            setState('saved');
            setTimeout(() => setState('idle'), 1500);
        } catch (err) {
            setState('idle');
            toast.fromError(err);
        }
    };

    if (!editable) {
        return (
            <p className={'text-sm text-gray-400 break-words'}>
                {allocation.notes || <span className={'text-gray-600'}>—</span>}
            </p>
        );
    }

    return (
        <div className={'relative'}>
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder={t('Add a note, e.g. Dynmap or voice chat')}
                maxLength={255}
                className={
                    'w-full rounded-lg bg-transparent px-2.5 py-1.5 -mx-2.5 text-sm text-gray-200 placeholder:text-gray-600 hover:bg-gray-950/40 focus:bg-gray-950/60 focus:outline-none focus:ring-1 focus:ring-raptor-500'
                }
            />
            {state !== 'idle' && (
                <span className={'absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-500'}>
                    {state === 'saving' ? t('Saving…') : t('Saved')}
                </span>
            )}
        </div>
    );
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const limit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.allocations);
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations, isEqual);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const [canCreate, canUpdate, canDelete] = usePermissions([
        'allocation.create',
        'allocation.update',
        'allocation.delete',
    ]);
    const { data, error, mutate } = getServerAllocations(allocations);
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState<Allocation | null>(null);
    const [busy, setBusy] = useState(false);

    useDeepCompareEffect(() => {
        if (data) setServerFromState((state) => ({ ...state, allocations: data }));
    }, [data]);

    const add = async () => {
        setAdding(true);
        try {
            const allocation = await createServerAllocation(uuid);
            await mutate(data?.concat(allocation), false);
            toast.success(t('Port added'), address(allocation));
        } catch (err) {
            toast.fromError(err);
        } finally {
            setAdding(false);
        }
    };

    const makePrimary = async (allocation: Allocation) => {
        await mutate((current) => current?.map((a) => ({ ...a, isDefault: a.id === allocation.id })), false);
        try {
            await setPrimaryServerAllocation(uuid, allocation.id);
            toast.success(t('Primary port changed'), t('Restart the server to use it.'));
        } catch (err) {
            toast.fromError(err);
            mutate();
        }
    };

    const remove = async () => {
        if (!removing) return;
        setBusy(true);
        try {
            await deleteServerAllocation(uuid, removing.id);
            await mutate((current) => current?.filter((a) => a.id !== removing.id), false);
            toast.success(t('Port removed'), address(removing));
            setRemoving(null);
        } catch (err) {
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const primary = data?.find((a) => a.isDefault);
    const others = (data || []).filter((a) => !a.isDefault);
    const full = (data?.length || 0) >= limit;

    return (
        <ServerContentBlock
            title={t('Network')}
            icon={GlobeAltIcon}
            description={t(
                'The addresses players and tools use to reach the server. Extra ports are useful for maps, voice chat or query.'
            )}
            actions={
                canCreate && limit > 0 ? (
                    <Button
                        icon={PlusIcon}
                        loading={adding}
                        disabled={!data || full}
                        onClick={add}
                        title={full ? t('The limit of ports has been reached.') : undefined}
                    >
                        {t('Add port')}
                    </Button>
                ) : undefined
            }
        >
            {error && (
                <div className={'mb-4'}>
                    <Callout tone={'red'}>{httpErrorToHuman(error)}</Callout>
                </div>
            )}
            {!data ? (
                <Skeleton className={'h-56 rounded-xl'} />
            ) : (
                <div className={'space-y-5'}>
                    {primary && (
                        <div
                            className={
                                'relative overflow-hidden rounded-xl ring-1 ring-raptor-500/25 bg-gradient-to-br from-raptor-500/[0.08] to-transparent px-5 py-5'
                            }
                        >
                            <p
                                className={
                                    'flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-raptor-300'
                                }
                            >
                                <StarIcon className={'w-4 h-4'} />
                                {t('Players connect with')}
                            </p>
                            <div className={'mt-2'}>
                                <CopyAddress allocation={primary} large />
                            </div>
                            {primary.alias && (
                                <p className={'mt-1 font-mono text-xs text-gray-500'}>
                                    {ip(primary.ip)}:{primary.port}
                                </p>
                            )}
                            <div className={'mt-3 max-w-lg'}>
                                <Notes allocation={primary} editable={canUpdate} />
                            </div>
                        </div>
                    )}

                    <div>
                        <div className={'mb-2 flex flex-wrap items-center gap-3'}>
                            <h2 className={'text-sm font-semibold text-gray-100'}>{t('Additional ports')}</h2>
                            {limit > 0 && (
                                <span className={'flex items-center gap-2 text-xs text-gray-500'}>
                                    {t('{{count}} of {{limit}} ports', { count: data.length, limit })}
                                    <Meter value={data.length} max={limit} className={'w-24'} />
                                </span>
                            )}
                        </div>
                        {others.length ? (
                            <ul className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 divide-y divide-gray-800'}>
                                {others.map((allocation) => (
                                    <li
                                        key={allocation.id}
                                        className={
                                            'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3'
                                        }
                                    >
                                        <div className={'sm:w-64 flex-shrink-0'}>
                                            <CopyAddress allocation={allocation} />
                                        </div>
                                        <div className={'min-w-0 flex-1'}>
                                            <Notes allocation={allocation} editable={canUpdate} />
                                        </div>
                                        <Menu
                                            className={'self-end sm:self-auto'}
                                            items={[
                                                {
                                                    label: t('Make primary'),
                                                    icon: StarIcon,
                                                    onClick: () => makePrimary(allocation),
                                                    hidden: !canUpdate,
                                                },
                                                {
                                                    label: t('Remove'),
                                                    icon: TrashIcon,
                                                    danger: true,
                                                    onClick: () => setRemoving(allocation),
                                                    hidden: !canDelete,
                                                },
                                            ]}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p
                                className={
                                    'rounded-xl ring-1 ring-dashed ring-gray-800 px-4 py-6 text-center text-sm text-gray-500'
                                }
                            >
                                {limit > 0
                                    ? t('No additional ports yet. Add one for plugins that need their own port.')
                                    : t('This server cannot have additional ports.')}
                            </p>
                        )}
                    </div>
                    {primary && !primary.alias && primary.ip === '0.0.0.0' && (
                        <Callout tone={'blue'}>
                            {t(
                                'The address 0.0.0.0 means every address of the node, players use the public IP of the node instead.'
                            )}
                        </Callout>
                    )}
                </div>
            )}
            <Confirm
                open={!!removing}
                title={t('Remove {{address}}?', { address: removing ? address(removing) : '' })}
                confirm={t('Remove port')}
                loading={busy}
                onConfirm={remove}
                onClose={() => setRemoving(null)}
            >
                {t('Plugins using this port stop working until they get another one.')}
            </Confirm>
        </ServerContentBlock>
    );
};
