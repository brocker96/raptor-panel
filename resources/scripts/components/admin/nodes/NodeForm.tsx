import React from 'react';
import { CloudIcon, LockClosedIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { getLocations, NodeValues } from '@/api/admin';
import { Card } from '@/components/admin/ui/Card';
import { Callout } from '@/components/admin/ui/Feedback';
import { FormGrid, NumberInput, Select, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import { Segmented } from '@/components/admin/ui/Page';
import { formatMb } from '@/components/admin/ui/hooks';

export const emptyNode: NodeValues = {
    name: '',
    description: '',
    location_id: 0,
    public: true,
    fqdn: '',
    scheme: window.location.protocol === 'https:' ? 'https' : 'http',
    behind_proxy: false,
    maintenance_mode: false,
    memory: 4096,
    memory_overallocate: 0,
    disk: 51200,
    disk_overallocate: 0,
    upload_size: 100,
    daemonListen: 8080,
    daemonSFTP: 2022,
    daemonBase: '/var/lib/pterodactyl/volumes',
};

const CF_HTTPS_PORTS = [443, 2053, 2083, 2087, 2096, 8443];

interface Props {
    values: NodeValues;
    onChange: (values: NodeValues) => void;
    errors: Record<string, string>;
    editing?: boolean;
}

export default ({ values, onChange, errors, editing }: Props) => {
    const { data: locations } = useResource(['admin', 'locations'], getLocations);
    const set =
        <K extends keyof NodeValues>(key: K) =>
        (value: NodeValues[K]) =>
            onChange({ ...values, [key]: value });
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(values.fqdn);
    const panelHttps = window.location.protocol === 'https:';

    return (
        <div className={'space-y-6'}>
            <Card title={'Details'}>
                <div className={'space-y-4'}>
                    <FormGrid>
                        <TextInput
                            label={'Name'}
                            required
                            value={values.name}
                            onChange={set('name')}
                            error={errors.name}
                            placeholder={'node-1'}
                        />
                        <Select
                            label={'Location'}
                            required
                            value={values.location_id || ''}
                            onChange={(v) => set('location_id')(Number(v))}
                            error={errors.location_id}
                            placeholder={locations?.length ? 'Choose a location' : 'Create a location first'}
                            options={(locations || []).map((l) => ({
                                value: l.id,
                                label: `${l.short}${l.long ? ` — ${l.long}` : ''}`,
                            }))}
                        />
                    </FormGrid>
                    <TextArea label={'Description'} value={values.description} onChange={set('description')} rows={2} />
                    <div className={'grid gap-3 sm:grid-cols-2'}>
                        <Toggle
                            label={'Public'}
                            description={'Used for automatic deployment.'}
                            checked={values.public}
                            onChange={set('public')}
                        />
                        <Toggle
                            label={'Maintenance mode'}
                            description={'Users cannot control servers on this node.'}
                            checked={values.maintenance_mode}
                            onChange={set('maintenance_mode')}
                        />
                    </div>
                </div>
            </Card>
            <Card
                title={'Connection'}
                icon={LockClosedIcon}
                description={'How the Panel and browsers reach Wings on this machine.'}
            >
                <div className={'space-y-4'}>
                    <TextInput
                        label={'FQDN'}
                        required
                        value={values.fqdn}
                        onChange={set('fqdn')}
                        error={errors.fqdn}
                        placeholder={'node1.example.com'}
                        description={'Domain name or IP address of the machine. Must be reachable from the internet.'}
                    />
                    <div className={'flex flex-col sm:flex-row sm:items-center gap-3'}>
                        <Segmented
                            id={'scheme'}
                            value={values.scheme}
                            onChange={set('scheme')}
                            options={[
                                { value: 'https', label: 'Use SSL (https)' },
                                { value: 'http', label: 'No SSL (http)' },
                            ]}
                        />
                        <span className={'text-xs text-gray-500'}>An IP address can only be used without SSL.</span>
                    </div>
                    {values.scheme === 'http' && panelHttps && (
                        <Callout tone={'red'}>
                            The Panel runs on HTTPS, browsers will block the console of a node without SSL.
                        </Callout>
                    )}
                    {values.scheme === 'https' && isIp && (
                        <Callout tone={'yellow'}>
                            Certificates are issued for domain names, use a domain for SSL.
                        </Callout>
                    )}
                    <Toggle
                        label={'Behind a proxy'}
                        description={'Wings runs on plain HTTP behind a proxy (nginx, Cloudflare) that terminates SSL.'}
                        checked={values.behind_proxy}
                        onChange={set('behind_proxy')}
                    />
                    <FormGrid cols={3}>
                        <NumberInput
                            label={'Daemon port'}
                            required
                            value={values.daemonListen}
                            onChange={set('daemonListen')}
                            error={errors.daemonListen}
                        />
                        <NumberInput
                            label={'SFTP port'}
                            required
                            value={values.daemonSFTP}
                            onChange={set('daemonSFTP')}
                            error={errors.daemonSFTP}
                        />
                        <NumberInput
                            label={'Upload limit'}
                            suffix={'MiB'}
                            value={values.upload_size}
                            onChange={set('upload_size')}
                            error={errors.upload_size}
                        />
                    </FormGrid>
                    {values.scheme === 'https' && !CF_HTTPS_PORTS.includes(values.daemonListen) && (
                        <Callout tone={'blue'} icon={CloudIcon}>
                            Port {values.daemonListen} cannot be proxied by Cloudflare. If the FQDN is orange-clouded
                            use 8443, otherwise keep it &quot;DNS only&quot;.
                        </Callout>
                    )}
                    <TextInput
                        label={'Daemon base directory'}
                        value={values.daemonBase}
                        onChange={set('daemonBase')}
                        error={errors.daemonBase}
                        disabled={editing}
                        description={
                            editing
                                ? 'Cannot be changed here, move the data and edit config.yml on the node instead.'
                                : 'Where server files are stored on the node.'
                        }
                    />
                </div>
            </Card>
            <Card
                title={'Resources'}
                description={
                    'The budget servers on this node are carved out of. Overallocation is in percent, -1 disables the check.'
                }
            >
                <FormGrid cols={4}>
                    <NumberInput
                        label={'Memory'}
                        suffix={'MiB'}
                        required
                        value={values.memory}
                        onChange={set('memory')}
                        error={errors.memory}
                        description={formatMb(values.memory)}
                    />
                    <NumberInput
                        label={'Memory overallocate'}
                        suffix={'%'}
                        value={values.memory_overallocate}
                        onChange={set('memory_overallocate')}
                        error={errors.memory_overallocate}
                    />
                    <NumberInput
                        label={'Disk'}
                        suffix={'MiB'}
                        required
                        value={values.disk}
                        onChange={set('disk')}
                        error={errors.disk}
                        description={formatMb(values.disk)}
                    />
                    <NumberInput
                        label={'Disk overallocate'}
                        suffix={'%'}
                        value={values.disk_overallocate}
                        onChange={set('disk_overallocate')}
                        error={errors.disk_overallocate}
                    />
                </FormGrid>
            </Card>
        </div>
    );
};
