import React, { useState } from 'react';
import classNames from 'classnames';
import isEqual from 'react-fast-compare';
import { CheckIcon, ClipboardCopyIcon, CubeIcon, PlayIcon, SearchIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import getServerStartup from '@/api/swr/getServerStartup';
import setSelectedDockerImage from '@/api/server/setSelectedDockerImage';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import { usePermissions } from '@/plugins/usePermissions';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useCopy } from '@/components/ui/CopyField';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import Button from '@/components/admin/ui/Button';
import { toast } from '@/components/admin/ui/Toast';
import VariableBox from '@/components/server/startup/VariableBox';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const known = ServerContext.useStoreState(
        ({ server }) => ({
            variables: server.data!.variables,
            invocation: server.data!.invocation,
            dockerImage: server.data!.dockerImage,
        }),
        isEqual
    );
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const [canChangeImage] = usePermissions(['startup.docker-image']);
    const [filter, setFilter] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const { copied, copy } = useCopy();

    const { data, error, mutate } = getServerStartup(uuid, {
        ...known,
        dockerImages: { [known.dockerImage]: known.dockerImage },
    });

    useDeepCompareEffect(() => {
        if (data) setServerFromState((s) => ({ ...s, invocation: data.invocation, variables: data.variables }));
    }, [data]);

    const images = Object.entries(data?.dockerImages || {});
    const custom = !!data && !images.some(([, value]) => value.toLowerCase() === known.dockerImage.toLowerCase());

    const chooseImage = async (value: string) => {
        if (value === known.dockerImage) return;
        setImage(value);
        try {
            await setSelectedDockerImage(uuid, value);
            setServerFromState((s) => ({ ...s, dockerImage: value }));
            toast.success(t('Docker image changed'), t('Restart the server to use it.'));
        } catch (err) {
            toast.fromError(err);
        } finally {
            setImage(null);
        }
    };

    const variables = (data?.variables || []).filter((v) =>
        `${v.name} ${v.envVariable} ${v.description}`.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <ServerContentBlock
            title={t('Startup')}
            icon={PlayIcon}
            description={t(
                'The command that starts the server, the Docker image it runs in and the settings of the egg.'
            )}
        >
            {error && !data ? (
                <Callout tone={'red'} title={t('The startup settings could not be loaded')}>
                    {httpErrorToHuman(error)}
                    <div className={'mt-3'}>
                        <Button size={'sm'} variant={'secondary'} onClick={() => mutate()}>
                            {t('Try again')}
                        </Button>
                    </div>
                </Callout>
            ) : !data ? (
                <Skeleton className={'h-64 rounded-xl'} />
            ) : (
                <div className={'space-y-6'}>
                    <div className={'grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-4'}>
                        <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 p-4 min-w-0'}>
                            <div className={'mb-2 flex items-center justify-between gap-2'}>
                                <p className={'text-xs text-gray-500'}>{t('Startup command')}</p>
                                <Button
                                    variant={'ghost'}
                                    size={'sm'}
                                    icon={copied ? CheckIcon : ClipboardCopyIcon}
                                    onClick={() => copy(data.invocation)}
                                >
                                    {copied ? t('Copied') : t('Copy')}
                                </Button>
                            </div>
                            <pre
                                className={
                                    'rounded-lg bg-gray-950/60 ring-1 ring-inset ring-gray-800 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-200 whitespace-pre-wrap break-all'
                                }
                            >
                                {data.invocation}
                            </pre>
                            <p className={'mt-2 text-xs text-gray-500'}>
                                {t('Variables are filled in automatically, change them below.')}
                            </p>
                        </div>
                        <div className={'rounded-xl ring-1 ring-gray-800 bg-gray-900/40 p-4'}>
                            <p className={'mb-2 flex items-center gap-1.5 text-xs text-gray-500'}>
                                <CubeIcon className={'w-4 h-4'} />
                                {t('Docker image')}
                            </p>
                            {images.length > 1 && !custom && canChangeImage ? (
                                <div className={'space-y-1'}>
                                    {images.map(([label, value]) => (
                                        <button
                                            key={value}
                                            type={'button'}
                                            disabled={!!image}
                                            onClick={() => chooseImage(value)}
                                            className={classNames(
                                                'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ring-1 ring-inset transition-colors',
                                                value === known.dockerImage
                                                    ? 'bg-raptor-500/10 ring-raptor-500/40 text-gray-50'
                                                    : 'ring-gray-800 text-gray-300 hover:ring-gray-600',
                                                image === value && 'animate-pulse'
                                            )}
                                        >
                                            <span
                                                className={classNames(
                                                    'w-2 h-2 rounded-full',
                                                    value === known.dockerImage ? 'bg-raptor-400' : 'bg-gray-700'
                                                )}
                                            />
                                            <span className={'truncate'}>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <p className={'font-mono text-xs text-gray-200 break-all'}>{known.dockerImage}</p>
                                    {custom && (
                                        <p className={'mt-2 text-xs text-gray-500'}>
                                            {t('Set by an administrator, it cannot be changed here.')}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className={'mb-3 flex flex-wrap items-center gap-3'}>
                            <h2 className={'text-base font-semibold text-gray-100'}>{t('Variables')}</h2>
                            <span className={'text-xs text-gray-500'}>
                                {t('Changes are saved automatically and apply on the next start.')}
                            </span>
                            {(data.variables.length || 0) > 6 && (
                                <div className={'relative ml-auto w-full sm:w-64'}>
                                    <SearchIcon
                                        className={'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500'}
                                    />
                                    <input
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        placeholder={t('Filter variables')}
                                        className={
                                            'w-full h-9 rounded-lg bg-gray-950/60 pl-8 pr-3 text-sm text-gray-100 ring-1 ring-inset ring-gray-700 focus:outline-none focus:ring-2 focus:ring-raptor-500'
                                        }
                                    />
                                </div>
                            )}
                        </div>
                        {variables.length ? (
                            <div className={'grid md:grid-cols-2 xl:grid-cols-3 gap-3'}>
                                {variables.map((variable) => (
                                    <VariableBox key={variable.envVariable} variable={variable} />
                                ))}
                            </div>
                        ) : (
                            <p className={'text-sm text-gray-500'}>
                                {filter ? t('No variables match.') : t('This egg has no variables.')}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
};
