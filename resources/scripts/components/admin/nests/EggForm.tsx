import React, { useRef, useState } from 'react';
import { CodeIcon, CogIcon, TerminalIcon } from '@heroicons/react/outline';
import { AdminEgg, AdminNest, EggValues } from '@/api/admin';
import type { EditorHandle } from '@/components/elements/editor/Editor';
import { Card } from '@/components/admin/ui/Card';
import { FormGrid, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import CodeField from '@/components/admin/ui/CodeField';
import Button from '@/components/admin/ui/Button';
import { t } from '@/i18n';

interface Props {
    egg?: AdminEgg;
    nests?: AdminNest[];
    /** Nest preselected when creating a new egg. */
    nestId?: number;
    errors: Record<string, string>;
    loading: boolean;
    submitLabel: string;
    onSubmit: (values: EggValues) => void;
}

const pretty = (json: string | null | undefined, fallback = '{}') => {
    if (!json) return fallback;
    try {
        return JSON.stringify(JSON.parse(json), null, 4);
    } catch {
        return json;
    }
};

export default ({ egg, nests, nestId, errors, loading, submitLabel, onSubmit }: Props) => {
    const [nest, setNest] = useState<number>(egg?.nest.id || nestId || nests?.[0]?.id || 0);
    const [name, setName] = useState(egg?.name || '');
    const [description, setDescription] = useState(egg?.description || '');
    const [images, setImages] = useState(
        egg
            ? Object.entries(egg.docker_images)
                  .map(([label, image]) => (label === image ? image : `${label}|${image}`))
                  .join('\n')
            : ''
    );
    const [startup, setStartup] = useState(egg?.startup || '');
    const [features, setFeatures] = useState((egg?.features || []).join(', '));
    const [denylist, setDenylist] = useState((egg?.file_denylist || []).join('\n'));
    const [forceIp, setForceIp] = useState(egg?.force_outgoing_ip || false);
    const [configFrom, setConfigFrom] = useState<number | null>(egg?.config_from || null);
    const [stop, setStop] = useState(egg?.config_stop || '');

    const startupConfig = useRef<EditorHandle>(null);
    const files = useRef<EditorHandle>(null);
    const logs = useRef<EditorHandle>(null);

    const siblings = egg
        ? egg.copy_options
        : (nests || []).find((n) => n.id === nest)?.eggs.map((e) => ({ id: e.id, name: e.name })) || [];

    const submit = () =>
        onSubmit({
            nest_id: egg ? undefined : nest,
            name,
            description,
            docker_images: images,
            startup,
            features: features
                .split(',')
                .map((f) => f.trim())
                .filter(Boolean),
            file_denylist: denylist
                .split('\n')
                .map((f) => f.trim())
                .filter(Boolean),
            force_outgoing_ip: forceIp,
            config_from: configFrom,
            config_stop: stop,
            config_startup: startupConfig.current?.getValue() ?? '',
            config_logs: logs.current?.getValue() ?? '',
            config_files: files.current?.getValue() ?? '',
        });

    return (
        <div className={'space-y-6'}>
            <Card title={t('General')} icon={CogIcon}>
                <div className={'space-y-4'}>
                    <FormGrid>
                        {!egg && (
                            <Select
                                label={t('Nest')}
                                required
                                value={nest}
                                onChange={(v) => setNest(Number(v))}
                                error={errors.nest_id}
                                options={(nests || []).map((n) => ({ value: n.id, label: n.name }))}
                            />
                        )}
                        <TextInput
                            label={t('Name')}
                            required
                            value={name}
                            onChange={setName}
                            error={errors.name}
                            placeholder={t('Paper')}
                        />
                    </FormGrid>
                    <TextArea label={t('Description')} value={description} onChange={setDescription} rows={2} />
                    <TextArea
                        label={t('Docker images')}
                        required
                        mono
                        rows={4}
                        value={images}
                        onChange={setImages}
                        error={errors.docker_images}
                        placeholder={t(
                            'Java 21|ghcr.io/pterodactyl/yolks:java_21\nJava 17|ghcr.io/pterodactyl/yolks:java_17'
                        )}
                        description={t('One per line. Use "Display name|image" to show a friendly name to users.')}
                    />
                    <TextArea
                        label={t('Startup command')}
                        required
                        mono
                        rows={3}
                        value={startup}
                        onChange={setStartup}
                        error={errors.startup}
                        placeholder={'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}'}
                    />
                    <FormGrid>
                        <TextInput
                            label={t('Features')}
                            value={features}
                            onChange={setFeatures}
                            placeholder={t('eula, java_version, pid_limit')}
                            description={t('Comma separated flags that enable extra behaviour in the server view.')}
                        />
                        <TextArea
                            label={t('File denylist')}
                            mono
                            rows={2}
                            value={denylist}
                            onChange={setDenylist}
                            description={t('Files users cannot open in the file manager, one per line.')}
                        />
                    </FormGrid>
                    <Toggle
                        label={t('Force outgoing IP')}
                        description={t(
                            'Outgoing traffic uses the IP of the primary allocation. Needed on machines with several public IPs.'
                        )}
                        checked={forceIp}
                        onChange={setForceIp}
                    />
                </div>
            </Card>
            <Card
                title={t('Process management')}
                icon={TerminalIcon}
                description={t('How Wings detects that the server started, stops it and rewrites configuration files.')}
            >
                <div className={'space-y-4'}>
                    <FormGrid>
                        <Select
                            label={t('Copy settings from')}
                            value={configFrom ?? ''}
                            onChange={(v) => setConfigFrom(v ? Number(v) : null)}
                            placeholder={t('None, use the settings below')}
                            error={errors.config_from}
                            options={siblings.map((s) => ({ value: s.id, label: s.name }))}
                            description={t('Inherit the fields below from another egg in the same nest.')}
                        />
                        <TextInput
                            label={t('Stop command')}
                            value={stop}
                            onChange={setStop}
                            error={errors.config_stop}
                            placeholder={'stop'}
                            description={t('Sent to the console to stop gracefully. ^C sends SIGINT.')}
                        />
                    </FormGrid>
                    <CodeField
                        ref={startupConfig}
                        label={t('Startup configuration')}
                        language={'JSON'}
                        height={'8rem'}
                        initialContent={pretty(egg?.config_startup, '{\n    "done": "Server started"\n}')}
                        error={errors.config_startup}
                        description={t('The "done" string marks the server as running when it appears in the console.')}
                    />
                    <CodeField
                        ref={files}
                        label={t('Configuration files')}
                        language={'JSON'}
                        height={'14rem'}
                        initialContent={pretty(egg?.config_files)}
                        error={errors.config_files}
                        description={t(
                            'Files Wings rewrites before every start, e.g. to set the port in server.properties.'
                        )}
                    />
                    <CodeField
                        ref={logs}
                        label={t('Log configuration')}
                        language={'JSON'}
                        height={'6rem'}
                        initialContent={pretty(egg?.config_logs)}
                        error={errors.config_logs}
                    />
                </div>
            </Card>
            <div className={'flex justify-end'}>
                <Button icon={CodeIcon} loading={loading} onClick={submit}>
                    {submitLabel}
                </Button>
            </div>
        </div>
    );
};
