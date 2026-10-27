import React, { useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AdjustmentsIcon,
    CodeIcon,
    CollectionIcon,
    DocumentDownloadIcon,
    PencilIcon,
    PlusIcon,
    ServerIcon,
    TerminalIcon,
    TrashIcon,
    UploadIcon,
    VariableIcon,
} from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import {
    AdminEgg,
    createEggVariable,
    deleteEgg,
    deleteEggVariable,
    EggVariable,
    EggVariableValues,
    exportEgg,
    getEgg,
    reimportEgg,
    updateEgg,
    updateEggScript,
    updateEggVariable,
} from '@/api/admin';
import type { EditorHandle } from '@/components/elements/editor/Editor';
import { Page, Tabs } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Badge, Callout, EmptyState, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm, Drawer } from '@/components/admin/ui/Overlay';
import { FormGrid, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import CodeField from '@/components/admin/ui/CodeField';
import Button, { IconButton } from '@/components/admin/ui/Button';
import { item } from '@/components/admin/ui/motion';
import { useAction } from '@/components/admin/ui/hooks';
import EggForm from '@/components/admin/nests/EggForm';
import ServerTable from '@/components/admin/servers/ServerTable';
import { NotFound } from '@/components/elements/ScreenBlock';
import { t } from '@/i18n';

const RULE_PRESETS = [
    { label: t('Text'), rules: 'required|string|max:191' },
    { label: t('Optional text'), rules: 'nullable|string' },
    { label: t('Number'), rules: 'required|integer|between:1,65535' },
    { label: t('Boolean'), rules: 'required|boolean' },
    { label: t('Choice'), rules: 'required|in:option1,option2' },
    { label: t('URL'), rules: 'nullable|url' },
];

const emptyVariable: EggVariableValues = {
    name: '',
    description: '',
    env_variable: '',
    default_value: '',
    rules: 'required|string|max:191',
    options: ['user_viewable', 'user_editable'],
};

const Variables = ({ egg }: { egg: AdminEgg }) => {
    const [editing, setEditing] = useState<EggVariable | 'new' | null>(null);
    const [deleting, setDeleting] = useState<EggVariable | null>(null);
    const [values, setValues] = useState<EggVariableValues>(emptyVariable);
    const set =
        <K extends keyof EggVariableValues>(key: K) =>
        (value: EggVariableValues[K]) =>
            setValues({ ...values, [key]: value });
    const toggleOption = (option: 'user_viewable' | 'user_editable', on: boolean) =>
        set('options')(on ? [...new Set([...values.options, option])] : values.options.filter((o) => o !== option));

    const open = (variable: EggVariable | 'new') => {
        setValues(
            variable === 'new'
                ? emptyVariable
                : {
                      name: variable.name,
                      description: variable.description,
                      env_variable: variable.env_variable,
                      default_value: variable.default_value,
                      rules: variable.rules,
                      options: [
                          ...(variable.user_viewable ? ['user_viewable' as const] : []),
                          ...(variable.user_editable ? ['user_editable' as const] : []),
                      ],
                  }
        );
        setEditing(variable);
    };

    const save = useAction(
        () =>
            editing === 'new'
                ? createEggVariable(egg.id, values)
                : updateEggVariable(egg.id, (editing as EggVariable).id, values),
        { success: t('Variable saved'), invalidate: [['admin', 'eggs', egg.id]], onSuccess: () => setEditing(null) }
    );
    const remove = useAction((id: number) => deleteEggVariable(egg.id, id), {
        success: t('Variable deleted'),
        invalidate: [['admin', 'eggs', egg.id]],
        onSuccess: () => setDeleting(null),
    });

    return (
        <>
            <Card
                title={t('Variables')}
                icon={VariableIcon}
                description={
                    'Settings servers of this egg can change. Available as {{ENV_VARIABLE}} in the startup command and as environment variables in the install script.'
                }
                actions={
                    <Button size={'sm'} icon={PlusIcon} onClick={() => open('new')}>
                        {t('Add variable')}
                    </Button>
                }
                flush
            >
                {egg.variables.length === 0 ? (
                    <EmptyState
                        icon={VariableIcon}
                        title={t('No variables')}
                        description={t('Add variables for settings like the server version or the jar file.')}
                    />
                ) : (
                    <ul className={'divide-y divide-gray-800 border-t border-gray-800'}>
                        <AnimatePresence initial={false}>
                            {egg.variables.map((variable) => (
                                <motion.li
                                    key={variable.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={'flex items-start gap-3 px-5 py-3'}
                                >
                                    <div className={'flex-1 min-w-0'}>
                                        <div className={'flex flex-wrap items-center gap-2'}>
                                            <p className={'text-sm font-medium text-gray-100'}>{variable.name}</p>
                                            <code
                                                className={'text-xs text-raptor-300'}
                                            >{`{{${variable.env_variable}}}`}</code>
                                            {!variable.user_viewable && <Badge>{t('Hidden')}</Badge>}
                                            {variable.user_viewable && !variable.user_editable && (
                                                <Badge tone={'blue'}>{t('Read only')}</Badge>
                                            )}
                                        </div>
                                        <p className={'mt-0.5 text-xs text-gray-500 break-words'}>
                                            {variable.description || t('No description')}
                                        </p>
                                        <p className={'mt-1 text-2xs text-gray-600 font-mono break-all'}>
                                            {t('default:')} {variable.default_value || '""'} · {variable.rules}
                                        </p>
                                    </div>
                                    <IconButton icon={PencilIcon} label={t('Edit')} onClick={() => open(variable)} />
                                    <IconButton
                                        icon={TrashIcon}
                                        label={t('Delete')}
                                        tone={'danger'}
                                        onClick={() => setDeleting(variable)}
                                    />
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </Card>
            <Drawer
                open={editing !== null}
                onClose={() => setEditing(null)}
                icon={VariableIcon}
                title={editing === 'new' ? t('New variable') : t('Edit {{name}}', { name: values.name })}
                footer={
                    <>
                        <Button variant={'ghost'} onClick={() => setEditing(null)}>
                            {t('Cancel')}
                        </Button>
                        <Button loading={save.loading} onClick={() => save.run()}>
                            {t('Save')}
                        </Button>
                    </>
                }
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={t('Name')}
                        required
                        value={values.name}
                        onChange={set('name')}
                        error={save.errors.name}
                        placeholder={t('Server version')}
                    />
                    <TextArea
                        label={t('Description')}
                        value={values.description}
                        onChange={set('description')}
                        rows={2}
                    />
                    <FormGrid>
                        <TextInput
                            label={t('Environment variable')}
                            required
                            value={values.env_variable}
                            onChange={(v) => set('env_variable')(v.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                            error={save.errors.env_variable}
                            placeholder={t('MINECRAFT_VERSION')}
                            className={'font-mono'}
                        />
                        <TextInput
                            label={t('Default value')}
                            value={values.default_value}
                            onChange={set('default_value')}
                            error={save.errors.default_value}
                        />
                    </FormGrid>
                    <div>
                        <TextInput
                            label={t('Validation rules')}
                            required
                            value={values.rules}
                            onChange={set('rules')}
                            error={save.errors.rules}
                            className={'font-mono'}
                        />
                        <div className={'mt-2 flex flex-wrap gap-1.5'}>
                            {RULE_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type={'button'}
                                    onClick={() => set('rules')(preset.rules)}
                                    className={
                                        'h-6 px-2 rounded-full bg-gray-800 text-xs text-gray-300 hover:bg-raptor-500/15 hover:text-white'
                                    }
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <Toggle
                        label={t('Users can view')}
                        description={t('Shown on the Startup page of the server.')}
                        checked={values.options.includes('user_viewable')}
                        onChange={(on) => toggleOption('user_viewable', on)}
                    />
                    <Toggle
                        label={t('Users can edit')}
                        description={t('The server owner may change the value.')}
                        checked={values.options.includes('user_editable')}
                        onChange={(on) => toggleOption('user_editable', on)}
                    />
                </div>
            </Drawer>
            <Confirm
                open={!!deleting}
                title={t('Delete {{name}}?', { name: deleting?.name })}
                confirm={t('Delete')}
                loading={remove.loading}
                onConfirm={() => deleting && remove.run(deleting.id)}
                onClose={() => setDeleting(null)}
            >
                {t('Servers using this egg lose the value of')} <code>{deleting?.env_variable}</code>
                {t('. Update the startup command if it uses the variable.')}
            </Confirm>
        </>
    );
};

const Script = ({ egg }: { egg: AdminEgg }) => {
    const editor = useRef<EditorHandle>(null);
    const [container, setContainer] = useState(egg.script.container);
    const [entry, setEntry] = useState(egg.script.entry);
    const [privileged, setPrivileged] = useState(egg.script.privileged);
    const [copyFrom, setCopyFrom] = useState<number | null>(egg.script.copy_from);

    const save = useAction(
        () =>
            updateEggScript(egg.id, {
                script_install: editor.current?.getValue() ?? egg.script.install ?? '',
                script_container: container,
                script_entry: entry,
                script_is_privileged: privileged,
                copy_script_from: copyFrom,
            }),
        { success: t('Install script saved'), invalidate: [['admin', 'eggs', egg.id]] }
    );

    return (
        <Card
            title={t('Install script')}
            icon={TerminalIcon}
            description={t(
                'Runs in a temporary container when a server is installed or reinstalled. Server files are mounted at /mnt/server.'
            )}
            footer={
                <Button loading={save.loading} onClick={() => save.run()}>
                    {t('Save script')}
                </Button>
            }
        >
            <div className={'space-y-4'}>
                <FormGrid cols={3}>
                    <TextInput
                        label={t('Install container')}
                        value={container}
                        onChange={setContainer}
                        error={save.errors.script_container}
                        placeholder={'ghcr.io/pterodactyl/installers:debian'}
                    />
                    <TextInput
                        label={t('Entrypoint')}
                        value={entry}
                        onChange={setEntry}
                        error={save.errors.script_entry}
                        placeholder={'bash'}
                    />
                    <Select
                        label={t('Copy script from')}
                        value={copyFrom ?? ''}
                        onChange={(v) => setCopyFrom(v ? Number(v) : null)}
                        placeholder={t('None, use this script')}
                        error={save.errors.copy_script_from}
                        options={egg.copy_options
                            .filter((o) => o.copyable_script)
                            .map((o) => ({ value: o.id, label: o.name }))}
                    />
                </FormGrid>
                {copyFrom && (
                    <Callout tone={'blue'}>
                        {t('The script of the selected egg is used, the editor below is ignored.')}
                    </Callout>
                )}
                <CodeField
                    ref={editor}
                    language={'Shell'}
                    height={'28rem'}
                    initialContent={egg.script.install || '#!/bin/bash\ncd /mnt/server\n'}
                    onSave={() => save.run()}
                />
                <Toggle
                    label={t('Run as privileged')}
                    description={t(
                        'Gives the install container extended permissions. Only enable it if the script needs it.'
                    )}
                    checked={privileged}
                    onChange={setPrivileged}
                />
            </div>
        </Card>
    );
};

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const navigate = useNavigate();
    const { data: egg, error } = useResource(['admin', 'eggs', id], (signal) => getEgg(id, signal));
    const [deleting, setDeleting] = useState(false);
    const [page, setPage] = useState(1);
    const fileInput = useRef<HTMLInputElement>(null);
    const base = `/admin/nests/eggs/${id}`;

    const save = useAction((values: Parameters<typeof updateEgg>[1]) => updateEgg(id, values), {
        success: t('Egg saved'),
        invalidate: [
            ['admin', 'eggs', id],
            ['admin', 'nests'],
        ],
    });
    const reimport = useAction((file: File) => reimportEgg(id, file), {
        success: t('Egg updated from file'),
        invalidate: [
            ['admin', 'eggs', id],
            ['admin', 'nests'],
        ],
    });
    const remove = useAction(() => deleteEgg(id), {
        success: t('Egg deleted'),
        invalidate: [['admin', 'nests']],
        onSuccess: () => navigate('/admin/nests'),
    });
    const download = useAction(async () => {
        const content = await exportEgg(id);
        const url = URL.createObjectURL(
            new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 4)], {
                type: 'application/json',
            })
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = `egg-${(egg?.name || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    });

    if (error) return <NotFound />;

    return (
        <Page
            title={egg?.name || t('Egg')}
            icon={CollectionIcon}
            crumbs={[
                { label: t('Nests & eggs'), to: '/admin/nests' },
                { label: egg?.nest.name || '…' },
                { label: egg?.name || '…' },
            ]}
            description={
                egg ? t('{{servers}} servers · by {{author}}', { servers: egg.servers, author: egg.author }) : undefined
            }
            guide={'egg-configuration'}
            actions={
                <>
                    <input
                        ref={fileInput}
                        type={'file'}
                        accept={'application/json,.json'}
                        className={'hidden'}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) reimport.run(file);
                            e.target.value = '';
                        }}
                    />
                    <Button
                        variant={'secondary'}
                        icon={UploadIcon}
                        loading={reimport.loading}
                        onClick={() => fileInput.current?.click()}
                    >
                        {t('Update from file')}
                    </Button>
                    <Button
                        variant={'secondary'}
                        icon={DocumentDownloadIcon}
                        loading={download.loading}
                        onClick={() => download.run()}
                    >
                        {t('Export')}
                    </Button>
                    <Button
                        variant={'danger'}
                        icon={TrashIcon}
                        disabled={!!egg?.servers}
                        onClick={() => setDeleting(true)}
                    >
                        {t('Delete')}
                    </Button>
                </>
            }
            tabs={
                <Tabs
                    id={'egg'}
                    items={[
                        { to: base, label: t('Configuration'), icon: AdjustmentsIcon, end: true },
                        { to: `${base}/variables`, label: t('Variables'), icon: VariableIcon },
                        { to: `${base}/script`, label: t('Install script'), icon: CodeIcon },
                        { to: `${base}/servers`, label: t('Servers'), icon: ServerIcon },
                    ]}
                />
            }
        >
            {!egg ? (
                <Skeleton className={'h-96 rounded-xl'} />
            ) : (
                <div key={egg.updated_at}>
                    <Routes>
                        <Route
                            index
                            element={
                                <EggForm
                                    egg={egg}
                                    errors={save.errors}
                                    loading={save.loading}
                                    submitLabel={t('Save configuration')}
                                    onSubmit={save.run}
                                />
                            }
                        />
                        <Route path={'variables'} element={<Variables egg={egg} />} />
                        <Route path={'script'} element={<Script egg={egg} />} />
                        <Route
                            path={'servers'}
                            element={
                                <Card flush>
                                    <ServerTable params={{ egg: egg.id }} page={page} onPage={setPage} />
                                </Card>
                            }
                        />
                        <Route path={'*'} element={<Navigate to={base} replace />} />
                    </Routes>
                </div>
            )}
            <Confirm
                open={deleting}
                title={t('Delete {{name}}?', { name: egg?.name })}
                challenge={egg?.name}
                confirm={t('Delete egg')}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setDeleting(false)}
            >
                {t('The egg, its variables and install script are deleted permanently.')}
            </Confirm>
        </Page>
    );
};
