import * as React from 'react';
import ContentBox from '@/components/elements/ContentBox';
import UpdatePasswordForm from '@/components/dashboard/forms/UpdatePasswordForm';
import UpdateEmailAddressForm from '@/components/dashboard/forms/UpdateEmailAddressForm';
import ConfigureTwoFactorForm from '@/components/dashboard/forms/ConfigureTwoFactorForm';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import { breakpoint } from '@/theme';
import styled from 'styled-components/macro';
import MessageBox from '@/components/MessageBox';
import AvatarForm from '@/components/dashboard/forms/AvatarForm';
import LanguageForm from '@/components/dashboard/forms/LanguageForm';
import { useLocation } from 'react-router-dom';
import { t } from '@/i18n';

const Container = styled.div`
    ${tw`flex flex-wrap`};

    & > div {
        ${tw`w-full`};

        ${breakpoint('sm')`
      width: calc(50% - 1rem);
    `}

        ${breakpoint('md')`
      ${tw`w-auto flex-1`};
    `}
    }
`;

export default () => {
    const state = useLocation().state as { twoFactorRedirect?: boolean } | null;

    return (
        <PageContentBlock title={t('Account Overview')}>
            {state?.twoFactorRedirect && (
                <MessageBox title={t('2-Factor Required')} type={'error'}>
                    {t('Your account must have two-factor authentication enabled in order to continue.')}
                </MessageBox>
            )}

            <div css={[tw`grid gap-8 lg:grid-cols-3`, state?.twoFactorRedirect ? tw`mt-4` : tw`mt-10`]}>
                <ContentBox css={tw`lg:col-span-2`} title={t('Profile Picture')} showFlashes={'account:avatar'}>
                    <AvatarForm />
                </ContentBox>
                <ContentBox title={t('Language')} showFlashes={'account:language'}>
                    <LanguageForm />
                </ContentBox>
            </div>
            <Container css={tw`lg:grid lg:grid-cols-3 mb-10 mt-8`}>
                <ContentBox title={t('Update Password')} showFlashes={'account:password'}>
                    <UpdatePasswordForm />
                </ContentBox>
                <ContentBox
                    css={tw`mt-8 sm:mt-0 sm:ml-8`}
                    title={t('Update Email Address')}
                    showFlashes={'account:email'}
                >
                    <UpdateEmailAddressForm />
                </ContentBox>
                <ContentBox css={tw`md:ml-8 mt-8 md:mt-0`} title={t('Two-Step Verification')}>
                    <ConfigureTwoFactorForm />
                </ContentBox>
            </Container>
        </PageContentBlock>
    );
};
