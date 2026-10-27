import React from 'react';
import { UserValues } from '@/api/admin';
import { FormGrid, TextInput, Toggle } from '@/components/admin/ui/Form';

interface Props {
    values: UserValues;
    onChange: (values: UserValues) => void;
    errors: Record<string, string>;
    creating?: boolean;
}

export default ({ values, onChange, errors, creating }: Props) => {
    const set =
        <K extends keyof UserValues>(key: K) =>
        (value: UserValues[K]) =>
            onChange({ ...values, [key]: value });

    return (
        <div className={'space-y-4'}>
            <FormGrid>
                <TextInput
                    label={'E-mail'}
                    type={'email'}
                    required
                    value={values.email}
                    onChange={set('email')}
                    error={errors.email}
                    autoComplete={'off'}
                />
                <TextInput
                    label={'Username'}
                    required
                    value={values.username}
                    onChange={set('username')}
                    error={errors.username}
                    autoComplete={'off'}
                />
                <TextInput
                    label={'First name'}
                    required
                    value={values.name_first}
                    onChange={set('name_first')}
                    error={errors.name_first}
                />
                <TextInput
                    label={'Last name'}
                    required
                    value={values.name_last}
                    onChange={set('name_last')}
                    error={errors.name_last}
                />
            </FormGrid>
            <TextInput
                label={'Password'}
                type={'password'}
                value={values.password || ''}
                onChange={set('password')}
                error={errors.password}
                autoComplete={'new-password'}
                description={
                    creating
                        ? 'Leave empty to e-mail the user a link to choose their own password.'
                        : 'Leave empty to keep the current password.'
                }
            />
            <Toggle
                label={'Administrator'}
                description={'Grants full access to the admin area, including every server, node and setting.'}
                checked={values.root_admin}
                onChange={set('root_admin')}
            />
        </div>
    );
};
