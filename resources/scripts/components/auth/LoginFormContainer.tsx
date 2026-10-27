import { GlobeAltIcon } from '@heroicons/react/outline';
import React, { forwardRef } from 'react';
import { Form } from 'formik';
import FlashMessageRender from '@/components/FlashMessageRender';
import Logo from '@/components/layout/Logo';
import i18n, { GUEST_LANGUAGE_KEY, languages, t } from '@/i18n';

/** Language of the sign in pages, remembered in this browser until the user signs in. */
const GuestLanguage = () => (
    <label className={'mt-8 flex items-center justify-center gap-2 text-xs text-gray-500'}>
        <GlobeAltIcon className={'w-4 h-4'} aria-hidden />
        <span className={'sr-only'}>{t('Language')}</span>
        <select
            value={i18n.language}
            onChange={(e) => {
                try {
                    localStorage.setItem(GUEST_LANGUAGE_KEY, e.currentTarget.value);
                } catch {
                    // Storage can be unavailable in private windows, the language just is not kept.
                }
                window.location.reload();
            }}
            className={'bg-transparent text-gray-400 hover:text-gray-200 focus:outline-none cursor-pointer'}
        >
            {Object.entries(languages).map(([code, name]) => (
                <option key={code} value={code} className={'bg-gray-900'}>
                    {name}
                </option>
            ))}
        </select>
    </label>
);

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
    subtitle?: string;
};

const highlights = [
    'Live console with instant search',
    'File editor that works on your phone',
    'Fast on the smallest VPS',
];

export default forwardRef<HTMLFormElement, Props>(({ title, subtitle, className, ...props }, ref) => (
    <div className={'min-h-screen grid lg:grid-cols-2'}>
        <aside
            className={'hidden lg:flex relative overflow-hidden flex-col justify-between p-12 border-r border-gray-800'}
        >
            {/* Brand panel, a large glowing mark on a subtle grid. */}
            <div
                className={'absolute inset-0 opacity-[0.07]'}
                style={{
                    backgroundImage:
                        'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                }}
            />
            <div
                className={'absolute -left-24 top-1/3 w-[36rem] h-[36rem] rounded-full bg-raptor-500/20 blur-[120px]'}
            />
            <div className={'relative'}>
                <Logo size={'md'} />
            </div>
            <div className={'relative'}>
                <img
                    src={'/brand/raptor-icon-256.webp'}
                    alt={''}
                    className={'w-40 h-40 mb-8 drop-shadow-[0_0_40px_rgb(82_211_33_/_0.45)]'}
                />
                <h1 className={'text-4xl xl:text-5xl leading-tight'}>
                    {t('Game servers,')}
                    <br />
                    <span className={'text-raptor-400'}>{t('without the friction.')}</span>
                </h1>
                <ul className={'mt-8 space-y-3'}>
                    {highlights.map((item) => (
                        <li key={item} className={'flex items-center gap-3 text-gray-300'}>
                            <span className={'w-1.5 h-1.5 rounded-full bg-raptor-500'} />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
            <p className={'relative text-xs text-gray-600'}>{t('Raptor Panel · based on Pterodactyl®')}</p>
        </aside>
        <main className={'flex flex-col items-center justify-center px-4 py-10 sm:px-8'}>
            <div className={'w-full max-w-sm'}>
                <div className={'lg:hidden flex justify-center mb-8'}>
                    <Logo size={'md'} />
                </div>
                {title && <h2 className={'text-2xl'}>{title}</h2>}
                {subtitle && <p className={'mt-1 text-sm text-gray-400'}>{subtitle}</p>}
                <FlashMessageRender className={'mt-6'} />
                <Form {...props} ref={ref} className={'mt-6 ' + (className || '')}>
                    <div className={'w-full'}>{props.children}</div>
                </Form>
                <GuestLanguage />
                <p className={'lg:hidden mt-6 text-center text-xs text-gray-600'}>
                    {t('Raptor Panel · based on Pterodactyl®')}
                </p>
            </div>
        </main>
    </div>
));
