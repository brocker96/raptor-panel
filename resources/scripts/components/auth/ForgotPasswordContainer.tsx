import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import requestPasswordResetEmail from '@/api/auth/requestPasswordResetEmail';
import { httpErrorToHuman } from '@/api/http';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import Field from '@/components/elements/Field';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Reaptcha from 'reaptcha';
import useRecaptcha from '@/plugins/useRecaptcha';
import useFlash from '@/plugins/useFlash';
import { t } from '@/i18n';

interface Values {
    email: string;
}

export default () => {
    const recaptcha = useRecaptcha();
    const [token, setToken] = useState('');

    const { clearFlashes, addFlash } = useFlash();
    const { enabled: recaptchaEnabled, siteKey } = useStoreState((state) => state.settings.data!.recaptcha);

    useEffect(() => {
        clearFlashes();
    }, []);

    const handleSubmission = ({ email }: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearFlashes();

        // If there is no token in the state yet, request the token and then abort this submit request
        // since it will be re-submitted when the recaptcha data is returned by the component.
        if (recaptchaEnabled && !token) {
            recaptcha.execute((error) => {
                console.error(error);

                setSubmitting(false);
                addFlash({ type: 'error', title: t('Error'), message: httpErrorToHuman(error) });
            });

            return;
        }

        requestPasswordResetEmail(email, token)
            .then((response) => {
                resetForm();
                addFlash({ type: 'success', title: t('Success'), message: response });
            })
            .catch((error) => {
                console.error(error);
                addFlash({ type: 'error', title: t('Error'), message: httpErrorToHuman(error) });
            })
            .then(() => {
                setToken('');
                recaptcha.reset();

                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={handleSubmission}
            initialValues={{ email: '' }}
            validationSchema={object().shape({
                email: string()
                    .email(t('A valid email address must be provided to continue.'))
                    .required(t('A valid email address must be provided to continue.')),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm }) => (
                <LoginFormContainer title={t('Request Password Reset')}>
                    <Field
                        light
                        label={t('Email')}
                        description={t(
                            'Enter your account email address to receive instructions on resetting your password.'
                        )}
                        name={'email'}
                        type={'email'}
                    />
                    <div css={tw`mt-6`}>
                        <Button type={'submit'} size={'xlarge'} disabled={isSubmitting} isLoading={isSubmitting}>
                            {t('Send Email')}
                        </Button>
                    </div>
                    {recaptchaEnabled && (
                        <Reaptcha
                            ref={recaptcha.ref}
                            onRender={recaptcha.onRender}
                            size={'invisible'}
                            sitekey={siteKey || '_invalid_key'}
                            onVerify={(response) => {
                                setToken(response);
                                submitForm();
                            }}
                            onExpire={() => {
                                setSubmitting(false);
                                setToken('');
                            }}
                        />
                    )}
                    <div css={tw`mt-6 text-center`}>
                        <Link to={'/auth/login'} className={'text-sm text-gray-400 hover:text-raptor-400 no-underline'}>
                            {t('Return to Login')}
                        </Link>
                    </div>
                </LoginFormContainer>
            )}
        </Formik>
    );
};
