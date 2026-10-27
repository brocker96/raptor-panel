import React from 'react';
import { MountValues } from '@/api/admin';
import { FormGrid, TextArea, TextInput, Toggle } from '@/components/admin/ui/Form';
import { t } from '@/i18n';

export const emptyMount: MountValues = {
    name: '',
    description: '',
    source: '',
    target: '',
    read_only: true,
    user_mountable: false,
};

export default ({
    values,
    onChange,
    errors,
}: {
    values: MountValues;
    onChange: (v: MountValues) => void;
    errors: Record<string, string>;
}) => {
    const set =
        <K extends keyof MountValues>(key: K) =>
        (value: MountValues[K]) =>
            onChange({ ...values, [key]: value });

    return (
        <div className={'space-y-4'}>
            <TextInput
                label={t('Name')}
                required
                value={values.name}
                onChange={set('name')}
                error={errors.name}
                placeholder={t('Shared maps')}
            />
            <TextArea
                label={t('Description')}
                value={values.description}
                onChange={set('description')}
                error={errors.description}
                rows={2}
            />
            <FormGrid>
                <TextInput
                    label={t('Source (on the node)')}
                    required
                    value={values.source}
                    onChange={set('source')}
                    error={errors.source}
                    placeholder={'/srv/shared/maps'}
                    description={t('Must be listed in allowed_mounts of the Wings config.')}
                    className={'font-mono'}
                />
                <TextInput
                    label={t('Target (in the container)')}
                    required
                    value={values.target}
                    onChange={set('target')}
                    error={errors.target}
                    placeholder={'/home/container/maps'}
                    className={'font-mono'}
                />
            </FormGrid>
            <Toggle
                label={t('Read only')}
                description={t('Servers can read but not change the files.')}
                checked={values.read_only}
                onChange={set('read_only')}
            />
            <Toggle
                label={t('User mountable')}
                description={t('Server owners can attach this mount themselves.')}
                checked={values.user_mountable}
                onChange={set('user_mountable')}
            />
        </div>
    );
};
