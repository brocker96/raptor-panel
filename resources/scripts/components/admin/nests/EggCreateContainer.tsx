import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CollectionIcon } from '@heroicons/react/outline';
import { useResource } from '@/api/query';
import { createEgg, getNests } from '@/api/admin';
import { Page } from '@/components/admin/ui/Page';
import { Skeleton } from '@/components/admin/ui/Feedback';
import { useAction } from '@/components/admin/ui/hooks';
import EggForm from '@/components/admin/nests/EggForm';
import { t } from '@/i18n';

export default () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { data: nests } = useResource(['admin', 'nests'], getNests);
    const create = useAction(createEgg, {
        success: (egg) => t('{{name}} created, now add its variables', { name: egg.name }),
        invalidate: [['admin', 'nests']],
        onSuccess: (egg) => navigate(`/admin/nests/eggs/${egg.id}/variables`),
    });

    return (
        <Page
            title={t('New egg')}
            icon={CollectionIcon}
            crumbs={[{ label: t('Nests & eggs'), to: '/admin/nests' }, { label: t('New egg') }]}
            description={t('Prefer importing a community egg when one exists, they are tested and maintained.')}
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
                    submitLabel={t('Create egg')}
                    onSubmit={create.run}
                />
            )}
        </Page>
    );
};
