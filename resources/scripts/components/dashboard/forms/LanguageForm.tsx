import React, { useState } from 'react';
import tw from 'twin.macro';
import Select from '@/components/elements/Select';
import Label from '@/components/elements/Label';
import updateAccountLanguage from '@/api/account/updateAccountLanguage';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { languages, t } from '@/i18n';

export default () => {
    const current = useStoreState((state) => state.user.data!.language);
    const panel = useStoreState((state) => state.settings.data!.locale);
    const { clearAndAddHttpError } = useFlash();
    const [saving, setSaving] = useState(false);

    const change = (value: string) => {
        setSaving(true);
        updateAccountLanguage(value || null)
            // The whole interface is translated when it loads, so it is simply loaded again.
            .then(() => window.location.reload())
            .catch((error) => {
                setSaving(false);
                clearAndAddHttpError({ key: 'account:language', error });
            });
    };

    return (
        <div>
            <Label htmlFor={'language'}>{t('Interface language')}</Label>
            <Select
                id={'language'}
                value={current || ''}
                disabled={saving}
                onChange={(e) => change(e.currentTarget.value)}
            >
                <option value={''}>
                    {t('Panel default ({{language}})', { language: languages[panel] || languages.en })}
                </option>
                {Object.entries(languages).map(([code, name]) => (
                    <option key={code} value={code}>
                        {name}
                    </option>
                ))}
            </Select>
            <p css={tw`mt-2 text-xs text-gray-400`}>
                {t('Applies to you only. The administrator sets the default language of the Panel.')}
            </p>
        </div>
    );
};
