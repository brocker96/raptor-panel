import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CollectionIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { createEgg, getNests } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Skeleton } from '@/components/admin/ui/Feedback';
import { useAction } from '@/components/admin/ui/hooks';
import EggForm from '@/components/admin/nests/EggForm';

export default () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { data: nests } = useResource(['admin', 'nests'], getNests);
    const create = useAction(createEgg, {
        success: (egg) => `${egg.name} created, now add its variables`,
        invalidate: [['admin', 'nests']],
        onSuccess: (egg) => navigate(`/admin/nests/eggs/${egg.id}/variables`),
    });

    return (
        <Page
            title={'New egg'}
            icon={CollectionIcon}
            crumbs={[{ label: 'Nests & eggs', to: '/admin/nests' }, { label: 'New egg' }]}
            description={'Prefer importing a community egg when one exists, they are tested and maintained.'}
            guide={'egg-configuration'}
        >
            {!nests ? (
                <Skeleton className={'h-96 rounded-xl'} />
            ) : (
                <EggForm
                    nests={nests}
                    nestId={Number(params.get('nest')) || undefined}
                    errors={create.errors}
                    loading={create.loading}
                    submitLabel={'Create egg'}
                    onSubmit={create.run}
                />
            )}
        </Page>
    );
};
