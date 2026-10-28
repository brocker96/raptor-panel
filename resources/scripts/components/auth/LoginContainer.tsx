import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import login, { loginWithPasskey } from '@/api/auth/login';
import { FingerPrintIcon } from '@heroicons/react/outline';
import RememberSwitch from '@/components/auth/RememberSwitch';
import { getPasskey, isPasskeyCancelled, passkeysSupported } from '@/lib/webauthn';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Reaptcha from 'reaptcha';
import useRecaptcha from '@/plugins/useRecaptcha';
import useFlash from '@/plugins/useFlash';
import { t } from '@/i18n';

interface Values {
    username: string;
    password: string;
    remember: boolean;
}

const LoginContainer = () => {
    const navigate = useNavigate();
    const recaptcha = useRecaptcha();
    const [token, setToken] = useState('');

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { enabled: recaptchaEnabled, siteKey } = useStoreState((state) => state.settings.data!.recaptcha);
    const passkeysEnabled = useStoreState((state) => state.settings.data!.passkeys !== false) && passkeysSupported();
    const [passkeyLoading, setPasskeyLoading] = useState(false);

    const signInWithPasskey = (remember: boolean) => {
        clearFlashes();
        setPasskeyLoading(true);
        loginWithPasskey((options) => getPasskey(options), remember)
            .then((response) => {
                // @ts-expect-error this is valid
                window.location = response.intended || '/';
            })
            .catch((error) => {
                setPasskeyLoading(false);
                if (!isPasskeyCancelled(error)) clearAndAddHttpError({ error });
            });
    };

    useEffect(() => {
        clearFlashes();
    }, []);

    const onSubmit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();

        // If there is no token in the state yet, request the token and then abort this submit request
        // since it will be re-submitted when the recaptcha data is returned by the component.
        if (recaptchaEnabled && !token) {
            recaptcha.execute((error) => {
                console.error(error);

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });

            return;
        }

        login({ ...values, recaptchaData: token })
            .then((response) => {
                if (response.complete) {
                    // @ts-expect-error this is valid
                    window.location = response.intended || '/';
                    return;
                }

                navigate('/auth/login/checkpoint', {
                    replace: true,
                    state: {
                        token: response.confirmationToken,
                        canTrustDevice: response.canTrustDevice,
                        trustDays: response.trustDays,
                    },
                });
            })
            .catch((error) => {
                console.error(error);

                setToken('');
                recaptcha.reset();

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ username: '', password: '', remember: true }}
            validationSchema={object().shape({
                username: string().required(t('A username or email must be provided.')),
                password: string().required(t('Please enter your account password.')),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm, values, setFieldValue }) => (
                <LoginFormContainer title={t('Welcome back')} subtitle={t('Sign in to manage your servers.')}>
                    <Field
                        light
                        type={'text'}
                        label={t('Username or Email')}
                        name={'username'}
                        disabled={isSubmitting}
                    />
                    <div css={tw`mt-6`}>
                        <Field
                            light
                            type={'password'}
                            label={t('Password')}
                            name={'password'}
                            disabled={isSubmitting}
                        />
                    </div>
                    <RememberSwitch
                        className={'mt-5'}
                        checked={values.remember}
                        onChange={(value) => setFieldValue('remember', value)}
                        disabled={isSubmitting}
                    >
                        {t('Keep me signed in')}
                    </RememberSwitch>
                    <div css={tw`mt-6`}>
                        <Button
                            type={'submit'}
                            size={'xlarge'}
                            isLoading={isSubmitting}
                            disabled={isSubmitting || passkeyLoading}
                        >
                            {t('Login')}
                        </Button>
                    </div>
                    {passkeysEnabled && (
                        <>
                            <div
                                className={
                                    'my-5 flex items-center gap-3 text-2xs uppercase tracking-wider text-gray-600'
                                }
                            >
                                <span className={'h-px flex-1 bg-gray-800'} />
                                {t('or')}
                                <span className={'h-px flex-1 bg-gray-800'} />
                            </div>
                            <button
                                type={'button'}
                                onClick={() => signInWithPasskey(values.remember)}
                                disabled={isSubmitting || passkeyLoading}
                                className={
                                    'w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-100 bg-gray-800/80 ring-1 ring-inset ring-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-60'
                                }
                            >
                                <FingerPrintIcon className={'w-5 h-5 text-raptor-400'} />
                                {passkeyLoading ? t('Waiting for your passkey…') : t('Sign in with a passkey')}
                            </button>
                        </>
                    )}
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
                        <Link
                            to={'/auth/password'}
                            className={'text-sm text-gray-400 hover:text-raptor-400 no-underline'}
                        >
                            {t('Forgot password?')}
                        </Link>
                    </div>
                </LoginFormContainer>
            )}
        </Formik>
    );
};

export default LoginContainer;
