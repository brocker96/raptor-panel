import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import classNames from 'classnames';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ServerIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { createServer, CreateServerValues, getEgg, getNests, getNodeAllocations, getNodes } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card, Details } from '@/components/admin/ui/Card';
import { Callout, Meter } from '@/components/admin/ui/Feedback';
import { FormGrid, NumberInput, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import Button from '@/components/admin/ui/Button';
import UserPicker from '@/components/admin/ui/UserPicker';
import CheckList from '@/components/admin/ui/CheckList';
import { formatMb, useAction } from '@/components/admin/ui/hooks';

const STEPS = ['Details', 'Egg', 'Node', 'Resources', 'Review'];

const PRESETS = [
    { label: 'Small', memory: 1024, disk: 5120, cpu: 100 },
    { label: 'Medium', memory: 4096, disk: 10240, cpu: 200 },
    { label: 'Large', memory: 8192, disk: 25600, cpu: 400 },
    { label: 'Huge', memory: 16384, disk: 51200, cpu: 800 },
];

export default () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [owner, setOwner] = useState<{ id: number; username: string; email: string } | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [externalId, setExternalId] = useState('');
    const [eggId, setEggId] = useState<number>(0);
    const [image, setImage] = useState('');
    const [startup, setStartup] = useState('');
    const [environment, setEnvironment] = useState<Record<string, string>>({});
    const [nodeId, setNodeId] = useState<number>(0);
    const [allocation, setAllocation] = useState<number>(0);
    const [additional, setAdditional] = useState<number[]>([]);
    const [limits, setLimits] = useState<CreateServerValues['limits']>({
        memory: 4096,
        swap: 0,
        disk: 10240,
        io: 500,
        cpu: 200,
        threads: null,
    });
    const [features, setFeatures] = useState<CreateServerValues['feature_limits']>({
        databases: 1,
        allocations: 1,
        backups: 2,
    });
    const [oomDisabled, setOomDisabled] = useState(false);
    const [skipScripts, setSkipScripts] = useState(false);
    const [startOnCompletion, setStartOnCompletion] = useState(true);

    const { data: nests } = useResource(['admin', 'nests'], getNests);
    const { data: egg } = useResource(['admin', 'eggs', eggId], (signal) => getEgg(eggId, signal), {
        enabled: eggId > 0,
    });
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));
    const { data: allocations } = useResource(
        ['admin', 'nodes', nodeId, 'allocations', 'free'],
        (signal) => getNodeAllocations(nodeId, { filter: 'unassigned', per_page: 100 }, signal),
        { enabled: nodeId > 0 }
    );

    // Prefill image, startup and variables whenever another egg is selected.
    useEffect(() => {
        if (!egg) return;
        setImage(Object.values(egg.docker_images)[0] || '');
        setStartup(egg.startup);
        setEnvironment(Object.fromEntries(egg.variables.map((v) => [v.env_variable, v.default_value || ''])));
    }, [egg?.id]);

    useEffect(() => {
        setAllocation(allocations?.data[0]?.id || 0);
        setAdditional([]);
    }, [nodeId, allocations?.data[0]?.id]);

    const node = nodes?.data.find((n) => n.id === nodeId);
    const values: CreateServerValues = {
        name,
        description,
        external_id: externalId || undefined,
        user: owner?.id || 0,
        egg: eggId,
        docker_image: image,
        startup,
        environment,
        skip_scripts: skipScripts,
        oom_disabled: oomDisabled,
        start_on_completion: startOnCompletion,
        limits,
        feature_limits: features,
        allocation: { default: allocation, additional },
    };

    const create = useAction(createServer, {
        success: 'Server created, installation started',
        invalidate: [
            ['admin', 'servers'],
            ['admin', 'nodes'],
            ['admin', 'overview'],
        ],
        onSuccess: (server) => navigate(`/admin/servers/${server.id}`),
    });

    // Jump to the step that contains the first invalid field after a failed submit.
    useEffect(() => {
        const fields = Object.keys(create.errors);
        if (!fields.length) return;
        const target = fields.some((f) => ['name', 'user', 'description', 'external_id'].includes(f))
            ? 0
            : fields.some((f) => f.startsWith('environment') || ['egg', 'docker_image', 'startup'].includes(f))
            ? 1
            : fields.some((f) => f.startsWith('allocation'))
            ? 2
            : 3;
        setDirection(-1);
        setStep(target);
    }, [create.errors]);

    const canContinue = useMemo(
        () =>
            [
                !!name && !!owner,
                !!eggId && !!image && !!startup,
                !!nodeId && !!allocation,
                limits.memory >= 0 && limits.disk >= 0,
                true,
            ][step],
        [step, name, owner, eggId, image, startup, nodeId, allocation, limits]
    );

    const go = (next: number) => {
        setDirection(next > step ? 1 : -1);
        setStep(next);
    };

    const err = (key: string) => create.errors[key];

    return (
        <Page
            title={'New server'}
            icon={ServerIcon}
            crumbs={[{ label: 'Servers', to: '/admin/servers' }, { label: 'New' }]}
            description={'Five short steps. The server is installed by its egg as soon as it is created.'}
            guide={'server-create'}
        >
            <div className={'flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1'}>
                {STEPS.map((label, index) => (
                    <React.Fragment key={label}>
                        {index > 0 && (
                            <div
                                className={classNames(
                                    'flex-1 min-w-[1rem] h-px',
                                    index <= step ? 'bg-raptor-500' : 'bg-gray-800'
                                )}
                            />
                        )}
                        <button
                            type={'button'}
                            disabled={index > step}
                            onClick={() => go(index)}
                            className={'flex items-center gap-2 flex-shrink-0 disabled:cursor-not-allowed'}
                        >
                            <motion.span
                                animate={{ scale: index === step ? 1.1 : 1 }}
                                className={classNames(
                                    'grid place-items-center w-7 h-7 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors',
                                    index < step
                                        ? 'bg-raptor-500 text-gray-950 ring-raptor-500'
                                        : index === step
                                        ? 'bg-raptor-500/15 text-raptor-300 ring-raptor-500/50 shadow-glow'
                                        : 'bg-gray-900 text-gray-500 ring-gray-700'
                                )}
                            >
                                {index < step ? <CheckIcon className={'w-4 h-4'} /> : index + 1}
                            </motion.span>
                            <span
                                className={classNames(
                                    'hidden md:inline text-sm',
                                    index === step ? 'text-gray-100 font-medium' : 'text-gray-500'
                                )}
                            >
                                {label}
                            </span>
                        </button>
                    </React.Fragment>
                ))}
            </div>

            <div className={'relative'}>
                <AnimatePresence mode={'wait'} initial={false} custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 32 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -32 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {step === 0 && (
                            <Card title={'Details'} description={'Who owns the server and how it is called.'}>
                                <div className={'space-y-4'}>
                                    <FormGrid>
                                        <TextInput
                                            label={'Server name'}
                                            required
                                            value={name}
                                            onChange={setName}
                                            error={err('name')}
                                            placeholder={'Survival SMP'}
                                            autoFocus
                                        />
                                        <UserPicker value={owner} onChange={setOwner} error={err('user')} />
                                    </FormGrid>
                                    <TextArea
                                        label={'Description'}
                                        value={description}
                                        onChange={setDescription}
                                        rows={2}
                                    />
                                    <TextInput
                                        label={'External ID'}
                                        value={externalId}
                                        onChange={setExternalId}
                                        error={err('external_id')}
                                        description={'Optional identifier from a billing system.'}
                                    />
                                </div>
                            </Card>
                        )}
                        {step === 1 && (
                            <Card title={'Egg'} description={'What kind of server to install.'}>
                                <div className={'space-y-4'}>
                                    <Select
                                        label={'Egg'}
                                        required
                                        value={eggId || ''}
                                        onChange={(v) => setEggId(Number(v))}
                                        error={err('egg')}
                                        placeholder={'Choose an egg'}
                                        options={(nests || []).flatMap((nest) =>
                                            nest.eggs.map((e) => ({ value: e.id, label: `${nest.name} → ${e.name}` }))
                                        )}
                                    />
                                    {egg && (
                                        <>
                                            <FormGrid>
                                                <Select
                                                    label={'Docker image'}
                                                    value={
                                                        Object.values(egg.docker_images).includes(image)
                                                            ? image
                                                            : '__custom'
                                                    }
                                                    onChange={(v) => v !== '__custom' && setImage(v)}
                                                    options={[
                                                        ...Object.entries(egg.docker_images).map(([label, value]) => ({
                                                            value,
                                                            label,
                                                        })),
                                                        { value: '__custom', label: 'Custom image…' },
                                                    ]}
                                                />
                                                <TextInput
                                                    label={'Image'}
                                                    value={image}
                                                    onChange={setImage}
                                                    error={err('docker_image')}
                                                    className={'font-mono'}
                                                />
                                            </FormGrid>
                                            <TextArea
                                                label={'Startup command'}
                                                mono
                                                rows={3}
                                                value={startup}
                                                onChange={setStartup}
                                                error={err('startup')}
                                            />
                                            {egg.variables.length > 0 && (
                                                <div>
                                                    <p
                                                        className={
                                                            'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'
                                                        }
                                                    >
                                                        Variables
                                                    </p>
                                                    <FormGrid>
                                                        {egg.variables.map((variable) => (
                                                            <TextInput
                                                                key={variable.id}
                                                                label={variable.name}
                                                                required={variable.rules.includes('required')}
                                                                value={environment[variable.env_variable] ?? ''}
                                                                onChange={(v) =>
                                                                    setEnvironment({
                                                                        ...environment,
                                                                        [variable.env_variable]: v,
                                                                    })
                                                                }
                                                                error={err(`environment.${variable.env_variable}`)}
                                                                description={`${variable.env_variable} · ${variable.rules}`}
                                                            />
                                                        ))}
                                                    </FormGrid>
                                                </div>
                                            )}
                                            <div className={'grid gap-3 sm:grid-cols-2'}>
                                                <Toggle
                                                    label={'Skip egg install script'}
                                                    description={'You will upload the files yourself.'}
                                                    checked={skipScripts}
                                                    onChange={setSkipScripts}
                                                />
                                                <Toggle
                                                    label={'Start when installed'}
                                                    checked={startOnCompletion}
                                                    onChange={setStartOnCompletion}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Card>
                        )}
                        {step === 2 && (
                            <Card
                                title={'Node & network'}
                                description={'Where the server runs and which ports it gets.'}
                            >
                                <div className={'space-y-4'}>
                                    <div className={'grid gap-3 sm:grid-cols-2'}>
                                        {(nodes?.data || []).map((n) => {
                                            const max = n.memory * (1 + Math.max(0, n.memory_overallocate) / 100);

                                            return (
                                                <button
                                                    key={n.id}
                                                    type={'button'}
                                                    onClick={() => setNodeId(n.id)}
                                                    className={classNames(
                                                        'text-left rounded-lg p-3 ring-1 ring-inset transition-colors',
                                                        nodeId === n.id
                                                            ? 'ring-raptor-500 bg-raptor-500/10'
                                                            : 'ring-gray-800 bg-gray-950/30 hover:ring-gray-600'
                                                    )}
                                                >
                                                    <p className={'text-sm font-medium text-gray-100'}>{n.name}</p>
                                                    <p className={'text-xs text-gray-500'}>
                                                        {n.location?.short} ·{' '}
                                                        {formatMb(Math.max(0, max - n.usage.memory))} memory free
                                                    </p>
                                                    <Meter
                                                        value={n.usage.memory + (nodeId === n.id ? limits.memory : 0)}
                                                        max={max}
                                                        className={'mt-2'}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {nodeId > 0 &&
                                        allocations &&
                                        (allocations.data.length === 0 ? (
                                            <Callout tone={'yellow'}>
                                                This node has no free allocations. Add ports on the Allocations tab of
                                                the node first.
                                            </Callout>
                                        ) : (
                                            <>
                                                <Select
                                                    label={'Primary allocation'}
                                                    required
                                                    value={allocation}
                                                    onChange={(v) => setAllocation(Number(v))}
                                                    error={err('allocation.default')}
                                                    options={allocations.data.map((a) => ({
                                                        value: a.id,
                                                        label: `${a.alias || a.ip}:${a.port}`,
                                                    }))}
                                                />
                                                <div>
                                                    <p className={'mb-1.5 text-xs font-medium text-gray-300'}>
                                                        Additional allocations
                                                    </p>
                                                    <CheckList
                                                        options={allocations.data
                                                            .filter((a) => a.id !== allocation)
                                                            .map((a) => ({
                                                                id: a.id,
                                                                label: `${a.alias || a.ip}:${a.port}`,
                                                            }))}
                                                        selected={additional}
                                                        onChange={setAdditional}
                                                        placeholder={'Filter ports…'}
                                                    />
                                                </div>
                                            </>
                                        ))}
                                </div>
                            </Card>
                        )}
                        {step === 3 && (
                            <Card
                                title={'Resources & limits'}
                                description={'0 means unlimited for memory, disk and CPU.'}
                            >
                                <div className={'space-y-5'}>
                                    <div className={'flex flex-wrap gap-2'}>
                                        {PRESETS.map((preset) => (
                                            <button
                                                key={preset.label}
                                                type={'button'}
                                                onClick={() =>
                                                    setLimits({
                                                        ...limits,
                                                        memory: preset.memory,
                                                        disk: preset.disk,
                                                        cpu: preset.cpu,
                                                    })
                                                }
                                                className={classNames(
                                                    'px-3 py-2 rounded-lg text-left ring-1 ring-inset transition-colors',
                                                    limits.memory === preset.memory &&
                                                        limits.disk === preset.disk &&
                                                        limits.cpu === preset.cpu
                                                        ? 'ring-raptor-500 bg-raptor-500/10'
                                                        : 'ring-gray-800 hover:ring-gray-600'
                                                )}
                                            >
                                                <span className={'block text-sm font-medium text-gray-100'}>
                                                    {preset.label}
                                                </span>
                                                <span className={'block text-2xs text-gray-500'}>
                                                    {formatMb(preset.memory)} · {formatMb(preset.disk)} · {preset.cpu}%
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <FormGrid cols={3}>
                                        <NumberInput
                                            label={'Memory'}
                                            suffix={'MiB'}
                                            value={limits.memory}
                                            onChange={(memory) => setLimits({ ...limits, memory })}
                                            error={err('limits.memory')}
                                            description={formatMb(limits.memory)}
                                        />
                                        <NumberInput
                                            label={'Swap'}
                                            suffix={'MiB'}
                                            value={limits.swap}
                                            onChange={(swap) => setLimits({ ...limits, swap })}
                                            error={err('limits.swap')}
                                            description={'0 disables, -1 unlimited'}
                                        />
                                        <NumberInput
                                            label={'Disk'}
                                            suffix={'MiB'}
                                            value={limits.disk}
                                            onChange={(disk) => setLimits({ ...limits, disk })}
                                            error={err('limits.disk')}
                                            description={formatMb(limits.disk)}
                                        />
                                        <NumberInput
                                            label={'CPU'}
                                            suffix={'%'}
                                            value={limits.cpu}
                                            onChange={(cpu) => setLimits({ ...limits, cpu })}
                                            error={err('limits.cpu')}
                                            description={'100% = one thread'}
                                        />
                                        <NumberInput
                                            label={'Block IO weight'}
                                            value={limits.io}
                                            onChange={(io) => setLimits({ ...limits, io })}
                                            error={err('limits.io')}
                                            description={'10 – 1000, default 500'}
                                        />
                                        <TextInput
                                            label={'CPU pinning'}
                                            value={limits.threads || ''}
                                            onChange={(threads) => setLimits({ ...limits, threads: threads || null })}
                                            error={err('limits.threads')}
                                            placeholder={'0-3'}
                                            description={'Optional, e.g. 0,1 or 0-3'}
                                        />
                                    </FormGrid>
                                    <FormGrid cols={3}>
                                        <NumberInput
                                            label={'Databases'}
                                            value={features.databases}
                                            onChange={(databases) => setFeatures({ ...features, databases })}
                                            error={err('feature_limits.databases')}
                                        />
                                        <NumberInput
                                            label={'Extra allocations'}
                                            value={features.allocations}
                                            onChange={(a) => setFeatures({ ...features, allocations: a })}
                                            error={err('feature_limits.allocations')}
                                        />
                                        <NumberInput
                                            label={'Backups'}
                                            value={features.backups}
                                            onChange={(backups) => setFeatures({ ...features, backups })}
                                            error={err('feature_limits.backups')}
                                        />
                                    </FormGrid>
                                    <Toggle
                                        label={'Disable OOM killer'}
                                        description={
                                            'The process is frozen instead of killed when it hits the memory limit.'
                                        }
                                        checked={oomDisabled}
                                        onChange={setOomDisabled}
                                    />
                                </div>
                            </Card>
                        )}
                        {step === 4 && (
                            <Card title={'Review'} description={'Check everything before creating the server.'}>
                                <Details
                                    items={[
                                        ['Name', name],
                                        ['Owner', owner ? `${owner.username} (${owner.email})` : null],
                                        ['Egg', egg ? `${egg.nest.name} → ${egg.name}` : null],
                                        [
                                            'Image',
                                            <code key={'i'} className={'text-xs break-all'}>
                                                {image}
                                            </code>,
                                        ],
                                        ['Node', node?.name],
                                        [
                                            'Allocation',
                                            allocations?.data.find((a) => a.id === allocation)
                                                ? `${allocations.data.find((a) => a.id === allocation)!.ip}:${
                                                      allocations.data.find((a) => a.id === allocation)!.port
                                                  }`
                                                : null,
                                        ],
                                        ['Extra ports', additional.length || 'None'],
                                        ['Memory / disk', `${formatMb(limits.memory)} / ${formatMb(limits.disk)}`],
                                        ['CPU', limits.cpu ? `${limits.cpu}%` : 'Unlimited'],
                                        [
                                            'Limits',
                                            `${features.databases} databases · ${features.allocations} allocations · ${features.backups} backups`,
                                        ],
                                    ]}
                                />
                            </Card>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className={'flex justify-between gap-2'}>
                <Button variant={'ghost'} icon={ChevronLeftIcon} disabled={step === 0} onClick={() => go(step - 1)}>
                    Back
                </Button>
                {step < STEPS.length - 1 ? (
                    <Button disabled={!canContinue} onClick={() => go(step + 1)}>
                        Continue <ChevronRightIcon className={'w-4 h-4'} />
                    </Button>
                ) : (
                    <Button icon={ServerIcon} loading={create.loading} onClick={() => create.run(values)}>
                        Create server
                    </Button>
                )}
            </div>
        </Page>
    );
};
