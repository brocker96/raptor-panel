import React, { useEffect, useMemo } from 'react';
import { useResource } from '@/api/query';
import { getEgg, getLocations, getNests, getNodes } from '@/api/admin';
import { PackageValues } from '@/api/raptor';
import { FormGrid, NumberInput, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import CheckList from '@/components/admin/ui/CheckList';
import { t } from '@/i18n';

export const emptyPackage: PackageValues = {
    slug: '',
    name: '',
    description: '',
    active: true,
    egg_id: 0,
    image: '',
    startup: '',
    environment: {},
    memory: 2048,
    swap: 0,
    disk: 10240,
    io: 500,
    cpu: 100,
    threads: '',
    oom_disabled: true,
    database_limit: 1,
    allocation_limit: 1,
    backup_limit: 2,
    location_ids: [],
    node_ids: [],
    port_range: [],
    dedicated_ip: false,
    start_on_completion: true,
    sort: 0,
};

export const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className={'space-y-4'}>
        <div>
            <h3 className={'text-sm font-semibold text-gray-100'}>{title}</h3>
            {hint && <p className={'mt-0.5 text-xs text-gray-500'}>{hint}</p>}
        </div>
        {children}
    </section>
);

interface Props {
    values: PackageValues;
    onChange: (values: PackageValues) => void;
    errors: Record<string, string>;
    editing: boolean;
}

export default ({ values, onChange, errors, editing }: Props) => {
    const set =
        <K extends keyof PackageValues>(key: K) =>
        (value: PackageValues[K]) =>
            onChange({ ...values, [key]: value });

    const { data: nests } = useResource(['admin', 'nests'], (signal) => getNests(signal));
    const { data: egg } = useResource(['admin', 'egg', values.egg_id], (signal) => getEgg(values.egg_id, signal), {
        enabled: values.egg_id > 0,
    });
    const { data: locations } = useResource(['admin', 'locations'], (signal) => getLocations(signal));
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));

    const eggOptions = useMemo(
        () =>
            (nests || []).flatMap((nest) =>
                nest.eggs.map((e) => ({ value: String(e.id), label: `${nest.name} · ${e.name}` }))
            ),
        [nests]
    );

    // Pick the first egg so a new package is valid right away.
    useEffect(() => {
        if (!values.egg_id && eggOptions.length) set('egg_id')(Number(eggOptions[0].value));
    }, [eggOptions.length]);

    return (
        <div className={'space-y-8'}>
            <Section title={t('Basics')} hint={t('The slug is what the billing system uses to order this package.')}>
                <FormGrid>
                    <TextInput
                        label={t('Name')}
                        required
                        value={values.name}
                        error={errors.name}
                        placeholder={'Minecraft 4 GB'}
                        onChange={(name) =>
                            onChange({
                                ...values,
                                name,
                                slug: editing || values.slug !== slugify(values.name) ? values.slug : slugify(name),
                            })
                        }
                    />
                    <TextInput
                        label={t('Slug')}
                        required
                        value={values.slug}
                        error={errors.slug}
                        placeholder={'minecraft-4gb'}
                        className={'font-mono'}
                        onChange={(slug) => set('slug')(slugify(slug))}
                    />
                </FormGrid>
                <TextArea
                    label={t('Description')}
                    rows={2}
                    value={values.description}
                    onChange={set('description')}
                    placeholder={t('Shown to the billing system, for example as the plan text in a shop.')}
                />
                <Toggle
                    label={t('Active')}
                    description={t('Inactive packages cannot be ordered, existing servers keep running.')}
                    checked={values.active}
                    onChange={set('active')}
                />
            </Section>

            <Section title={t('Game')}>
                <Select
                    label={t('Egg')}
                    value={String(values.egg_id || '')}
                    options={eggOptions}
                    error={errors.egg_id}
                    onChange={(id) => onChange({ ...values, egg_id: Number(id), image: '', environment: {} })}
                />
                <FormGrid>
                    <Select
                        label={t('Docker image')}
                        value={values.image}
                        placeholder={t('Default of the egg')}
                        options={Object.entries(egg?.docker_images || {}).map(([label, value]) => ({ value, label }))}
                        onChange={set('image')}
                    />
                    <NumberInput
                        label={t('Sort order')}
                        value={values.sort}
                        onChange={set('sort')}
                        description={t('Lower numbers are listed first.')}
                    />
                </FormGrid>
                <TextArea
                    label={t('Startup command')}
                    mono
                    rows={2}
                    value={values.startup}
                    onChange={set('startup')}
                    placeholder={egg?.startup || ''}
                    description={t('Leave empty to use the startup command of the egg.')}
                />
            </Section>

            <Section
                title={t('Resources')}
                hint={t('Memory, swap and disk in MiB, CPU in percent of one core. 0 means unlimited.')}
            >
                <FormGrid>
                    <NumberInput
                        label={t('Memory (MiB)')}
                        value={values.memory}
                        onChange={set('memory')}
                        error={errors.memory}
                    />
                    <NumberInput
                        label={t('Disk (MiB)')}
                        value={values.disk}
                        onChange={set('disk')}
                        error={errors.disk}
                    />
                    <NumberInput label={t('CPU (%)')} value={values.cpu} onChange={set('cpu')} error={errors.cpu} />
                    <NumberInput
                        label={t('Swap (MiB)')}
                        value={values.swap}
                        onChange={set('swap')}
                        error={errors.swap}
                    />
                    <NumberInput
                        label={t('Block IO weight')}
                        value={values.io}
                        onChange={set('io')}
                        error={errors.io}
                    />
                    <TextInput
                        label={t('CPU threads')}
                        value={values.threads}
                        onChange={set('threads')}
                        placeholder={'0-3'}
                        error={errors.threads}
                    />
                </FormGrid>
                <Toggle
                    label={t('Disable the OOM killer')}
                    description={t('The server is not killed when it runs out of memory.')}
                    checked={values.oom_disabled}
                    onChange={set('oom_disabled')}
                />
            </Section>

            <Section title={t('Features')}>
                <FormGrid>
                    <NumberInput
                        label={t('Databases')}
                        value={values.database_limit}
                        onChange={set('database_limit')}
                    />
                    <NumberInput
                        label={t('Extra allocations')}
                        value={values.allocation_limit}
                        onChange={set('allocation_limit')}
                    />
                    <NumberInput label={t('Backups')} value={values.backup_limit} onChange={set('backup_limit')} />
                </FormGrid>
            </Section>

            <Section
                title={t('Placement')}
                hint={t('New servers go to the emptiest node that fits. Nothing selected means every public node.')}
            >
                <div>
                    <p className={'mb-2 text-xs font-medium text-gray-300'}>{t('Locations')}</p>
                    <CheckList
                        options={(locations || []).map((l) => ({
                            id: l.id,
                            label: l.short,
                            hint: l.long || undefined,
                        }))}
                        selected={values.location_ids}
                        onChange={set('location_ids')}
                    />
                </div>
                <div>
                    <p className={'mb-2 text-xs font-medium text-gray-300'}>{t('Only these nodes')}</p>
                    <CheckList
                        options={(nodes?.data || []).map((n) => ({ id: n.id, label: n.name, hint: n.location?.short }))}
                        selected={values.node_ids}
                        onChange={set('node_ids')}
                    />
                </div>
                <TextInput
                    label={t('Ports')}
                    value={values.port_range.join(', ')}
                    placeholder={'25565-25665'}
                    description={t('Ports or ranges the main allocation is taken from, empty for any free port.')}
                    error={errors['port_range.0']}
                    onChange={(v) => set('port_range')(v.split(/[\s,]+/).filter(Boolean))}
                />
                <Toggle
                    label={t('Dedicated IP')}
                    description={t('Only use IP addresses that no other server uses.')}
                    checked={values.dedicated_ip}
                    onChange={set('dedicated_ip')}
                />
                <Toggle
                    label={t('Start after installation')}
                    checked={values.start_on_completion}
                    onChange={set('start_on_completion')}
                />
            </Section>

            {!!egg?.variables.length && (
                <Section
                    title={t('Variables')}
                    hint={t('Defaults for new servers. The billing system can still send its own values.')}
                >
                    <FormGrid>
                        {egg.variables.map((variable) => (
                            <TextInput
                                key={variable.env_variable}
                                label={variable.name}
                                className={'font-mono'}
                                value={values.environment[variable.env_variable] ?? ''}
                                placeholder={variable.default_value}
                                description={variable.env_variable}
                                onChange={(v) => {
                                    const environment = { ...values.environment, [variable.env_variable]: v };
                                    if (v === '') delete environment[variable.env_variable];
                                    set('environment')(environment);
                                }}
                            />
                        ))}
                    </FormGrid>
                </Section>
            )}
        </div>
    );
};
