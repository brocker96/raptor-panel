import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FolderIcon, LinkIcon, TrashIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { deleteMount, getMount, getNests, getNodes, MountValues, syncMount, updateMount } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { Callout, Skeleton } from '@/components/admin/ui/Feedback';
import { Confirm } from '@/components/admin/ui/Overlay';
import Button from '@/components/admin/ui/Button';
import CheckList from '@/components/admin/ui/CheckList';
import { useAction } from '@/components/admin/ui/hooks';
import MountForm from '@/components/admin/mounts/MountForm';
import { NotFound } from '@/components/elements/ScreenBlock';

export default () => {
    const id = Number(useParams<{ id: string }>().id);
    const navigate = useNavigate();
    const { data: mount, error } = useResource(['admin', 'mounts', id], (signal) => getMount(id, signal));
    const { data: nests } = useResource(['admin', 'nests'], getNests);
    const { data: nodes } = useResource(['admin', 'nodes', 'all'], (signal) => getNodes({ per_page: 100 }, signal));
    const [values, setValues] = useState<MountValues | null>(null);
    const [eggs, setEggs] = useState<number[]>([]);
    const [nodeIds, setNodeIds] = useState<number[]>([]);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!mount) return;
        setValues({
            name: mount.name,
            description: mount.description || '',
            source: mount.source,
            target: mount.target,
            read_only: mount.read_only,
            user_mountable: mount.user_mountable,
        });
        setEggs(mount.eggs.map((egg) => egg.id));
        setNodeIds(mount.nodes.map((node) => node.id));
    }, [mount]);

    const save = useAction((v: MountValues) => updateMount(id, v), {
        success: 'Mount updated',
        invalidate: [['admin', 'mounts']],
    });
    const sync = useAction(() => syncMount(id, { eggs, nodes: nodeIds }), {
        success: 'Eggs and nodes updated',
        invalidate: [['admin', 'mounts']],
    });
    const remove = useAction(() => deleteMount(id), {
        success: 'Mount deleted',
        invalidate: [['admin', 'mounts']],
        onSuccess: () => navigate('/admin/mounts'),
    });

    if (error) return <NotFound />;

    return (
        <Page
            title={mount?.name || 'Mount'}
            icon={FolderIcon}
            crumbs={[{ label: 'Mounts', to: '/admin/mounts' }, { label: mount?.name || '…' }]}
            description={
                mount ? (
                    <code className={'text-xs'}>
                        {mount.source} → {mount.target}
                    </code>
                ) : undefined
            }
            guide={'mounts'}
            actions={
                <Button variant={'danger'} icon={TrashIcon} onClick={() => setDeleting(true)}>
                    Delete
                </Button>
            }
        >
            {!mount || !values ? (
                <Skeleton className={'h-96 rounded-xl'} />
            ) : (
                <div className={'grid gap-6 lg:grid-cols-2'}>
                    <Card
                        title={'Configuration'}
                        footer={
                            <Button loading={save.loading} onClick={() => save.run(values)}>
                                Save
                            </Button>
                        }
                    >
                        <MountForm values={values} onChange={setValues} errors={save.errors} />
                    </Card>
                    <div className={'space-y-6'}>
                        <Card
                            title={'Availability'}
                            icon={LinkIcon}
                            description={
                                'The mount can only be attached to servers that use one of these eggs and run on one of these nodes.'
                            }
                            footer={
                                <Button loading={sync.loading} onClick={() => sync.run()}>
                                    Save availability
                                </Button>
                            }
                        >
                            <div className={'space-y-4'}>
                                <div>
                                    <p className={'mb-2 text-xs font-medium text-gray-300'}>Eggs</p>
                                    <CheckList
                                        options={(nests || []).flatMap((nest) =>
                                            nest.eggs.map((egg) => ({ id: egg.id, label: egg.name, group: nest.name }))
                                        )}
                                        selected={eggs}
                                        onChange={setEggs}
                                        placeholder={'Filter eggs…'}
                                    />
                                </div>
                                <div>
                                    <p className={'mb-2 text-xs font-medium text-gray-300'}>Nodes</p>
                                    <CheckList
                                        options={(nodes?.data || []).map((node) => ({
                                            id: node.id,
                                            label: node.name,
                                            hint: node.fqdn,
                                        }))}
                                        selected={nodeIds}
                                        onChange={setNodeIds}
                                        placeholder={'Filter nodes…'}
                                    />
                                </div>
                            </div>
                        </Card>
                        <Card title={'Attached to servers'} flush>
                            {mount.servers.length ? (
                                <ul className={'divide-y divide-gray-800'}>
                                    {mount.servers.map((server) => (
                                        <li key={server.id}>
                                            <Link
                                                to={`/admin/servers/${server.id}/mounts`}
                                                className={
                                                    'block px-5 py-3 text-sm text-gray-200 hover:bg-white/[0.03] no-underline'
                                                }
                                            >
                                                {server.name}{' '}
                                                <span className={'text-gray-500'}>· {server.identifier}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className={'px-5 pb-5'}>
                                    <Callout tone={'blue'}>
                                        Attach the mount to a server on the Mounts tab of the server.
                                    </Callout>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
            <Confirm
                open={deleting}
                title={'Delete this mount?'}
                confirm={'Delete'}
                loading={remove.loading}
                onConfirm={() => remove.run()}
                onClose={() => setDeleting(false)}
            >
                It is detached from every server the next time they restart. Files on the node are not deleted.
            </Confirm>
        </Page>
    );
};
