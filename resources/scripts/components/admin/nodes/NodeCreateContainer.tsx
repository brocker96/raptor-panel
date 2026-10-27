import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChipIcon } from '@heroicons/react/outline';
import { createNode, NodeValues } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import Button from '@/components/admin/ui/Button';
import { item } from '@/components/admin/ui/motion';
import { useAction } from '@/components/admin/ui/hooks';
import NodeForm, { emptyNode } from '@/components/admin/nodes/NodeForm';

export default () => {
    const navigate = useNavigate();
    const [values, setValues] = useState<NodeValues>(emptyNode);
    const create = useAction(createNode, {
        success: 'Node created, now install Wings on it',
        invalidate: [
            ['admin', 'nodes'],
            ['admin', 'locations'],
        ],
        onSuccess: ({ id }) => navigate(`/admin/nodes/${id}/configuration`),
    });

    return (
        <Page
            title={'New node'}
            icon={ChipIcon}
            crumbs={[{ label: 'Nodes', to: '/admin/nodes' }, { label: 'New' }]}
            description={'Register a machine. After saving you get the configuration to install on it.'}
            guide={'nodes'}
        >
            <NodeForm values={values} onChange={setValues} errors={create.errors} />
            <motion.div variants={item} className={'flex justify-end gap-2'}>
                <Button variant={'ghost'} to={'/admin/nodes'}>
                    Cancel
                </Button>
                <Button loading={create.loading} onClick={() => create.run(values)}>
                    Create node
                </Button>
            </motion.div>
        </Page>
    );
};
