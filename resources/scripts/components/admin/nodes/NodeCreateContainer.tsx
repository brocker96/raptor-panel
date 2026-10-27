import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChipIcon } from '@heroicons/react/outline';
import { createNode, NodeValues } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import Button from '@/components/admin/ui/Button';
import { useAction } from '@/components/admin/ui/hooks';
import NodeForm, { emptyNode } from '@/components/admin/nodes/NodeForm';
import { t } from '@/i18n';

export default () => {
    const navigate = useNavigate();
    const [values, setValues] = useState<NodeValues>(emptyNode);
    const create = useAction(createNode, {
        success: t('Node created, now install Wings on it'),
        invalidate: [
            ['admin', 'nodes'],
            ['admin', 'locations'],
        ],
        onSuccess: ({ id }) => navigate(`/admin/nodes/${id}/configuration`),
    });

    return (
        <Page
            title={t('New node')}
            icon={ChipIcon}
            crumbs={[{ label: t('Nodes'), to: '/admin/nodes' }, { label: t('New') }]}
            description={t('Register a machine. After saving you get the configuration to install on it.')}
            guide={'nodes'}
        >
            <NodeForm values={values} onChange={setValues} errors={create.errors} />
            <div className={'flex justify-end gap-2'}>
                <Button variant={'ghost'} to={'/admin/nodes'}>
                    {t('Cancel')}
                </Button>
                <Button loading={create.loading} onClick={() => create.run(values)}>
                    {t('Create node')}
                </Button>
            </div>
        </Page>
    );
};
