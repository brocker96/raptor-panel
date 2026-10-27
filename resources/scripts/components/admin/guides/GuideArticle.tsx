import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import copy from 'copy-to-clipboard';
import {
    CheckIcon,
    ChevronDownIcon,
    ClipboardCopyIcon,
    ExclamationIcon,
    LightBulbIcon,
    QuestionMarkCircleIcon,
} from '@heroicons/react/outline';
import classNames from 'classnames';
import { Guide } from '@/components/admin/guides/types';
import { findGuide } from '@/components/admin/guides';
import { item } from '@/components/admin/ui/motion';
import { t } from '@/i18n';

/** Renders the tiny subset of markdown used in guides: **bold** and `code`. */
export const Inline = ({ text }: { text: string }) => (
    <>
        {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className={'font-semibold text-gray-100'}>
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return (
                    <code
                        key={index}
                        className={'px-1 py-px rounded bg-gray-800 text-raptor-200 font-mono text-[0.85em] break-words'}
                    >
                        {part.slice(1, -1)}
                    </code>
                );
            }

            return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
    </>
);

/** "Label — explanation" points get a highlighted label. */
const Point = ({ text }: { text: string }) => {
    const [label, ...rest] = text.split(' — ');
    if (!rest.length) return <Inline text={text} />;

    return (
        <>
            <span className={'font-medium text-gray-100'}>
                <Inline text={label} />
            </span>
            <span className={'text-gray-500'}> — </span>
            <Inline text={rest.join(' — ')} />
        </>
    );
};

const CodeBlock = ({ label, content }: { label?: string; content: string }) => {
    const [copied, setCopied] = useState(false);

    return (
        <div className={'rounded-lg bg-black/60 ring-1 ring-inset ring-gray-800 overflow-hidden'}>
            <div
                className={'flex items-center justify-between px-3 h-8 border-b border-gray-800 text-2xs text-gray-500'}
            >
                <span className={'truncate'}>{label ? <Inline text={label} /> : t('Terminal')}</span>
                <button
                    type={'button'}
                    onClick={() => {
                        copy(content);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    className={'flex items-center gap-1 hover:text-gray-200'}
                >
                    {copied ? (
                        <CheckIcon className={'w-3.5 h-3.5 text-raptor-400'} />
                    ) : (
                        <ClipboardCopyIcon className={'w-3.5 h-3.5'} />
                    )}
                    {copied ? t('Copied') : t('Copy')}
                </button>
            </div>
            <pre className={'p-3 overflow-x-auto text-xs leading-relaxed text-gray-200 font-mono'}>{content}</pre>
        </div>
    );
};

const Faq = ({ q, a }: { q: string; a: string }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className={'rounded-lg ring-1 ring-inset ring-gray-800 bg-gray-950/30'}>
            <button
                type={'button'}
                onClick={() => setOpen(!open)}
                className={'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-gray-100'}
                aria-expanded={open}
            >
                <QuestionMarkCircleIcon className={'w-4 h-4 flex-shrink-0 text-raptor-400'} />
                <span className={'flex-1'}>{q}</span>
                <ChevronDownIcon
                    className={classNames('w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')}
                />
            </button>
            <motion.div
                initial={false}
                animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                className={'overflow-hidden'}
            >
                <p className={'px-3 pb-3 pl-10 text-sm text-gray-400 leading-relaxed'}>
                    <Inline text={a} />
                </p>
            </motion.div>
        </div>
    );
};

export default ({ guide, onNavigate }: { guide: Guide; onNavigate?: (key: string) => void }) => (
    <motion.article
        initial={'hidden'}
        animate={'show'}
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className={'space-y-7'}
    >
        <motion.p variants={item} className={'text-sm text-gray-300 leading-relaxed'}>
            {guide.summary}
        </motion.p>
        {guide.sections.map((section, index) => (
            <motion.section key={index} variants={item} className={'space-y-3'}>
                <h3 className={'flex items-center gap-2 text-base font-semibold text-gray-50'}>
                    <span
                        className={
                            'grid place-items-center w-6 h-6 rounded-md bg-raptor-500/10 text-raptor-300 text-xs ring-1 ring-inset ring-raptor-500/25'
                        }
                    >
                        {index + 1}
                    </span>
                    {section.heading}
                </h3>
                {section.body?.split('\n\n').map((paragraph, i) => (
                    <p key={i} className={'text-sm text-gray-400 leading-relaxed'}>
                        <Inline text={paragraph} />
                    </p>
                ))}
                {section.steps && (
                    <ol className={'space-y-2'}>
                        {section.steps.map((step, i) => (
                            <li key={i} className={'flex gap-3 text-sm text-gray-300 leading-relaxed'}>
                                <span
                                    className={
                                        'flex-shrink-0 grid place-items-center w-5 h-5 mt-0.5 rounded-full bg-gray-800 text-2xs font-semibold text-gray-300'
                                    }
                                >
                                    {i + 1}
                                </span>
                                <span className={'min-w-0'}>
                                    <Inline text={step} />
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
                {section.points && (
                    <ul className={'space-y-2'}>
                        {section.points.map((point, i) => (
                            <li key={i} className={'flex gap-3 text-sm text-gray-400 leading-relaxed'}>
                                <span className={'flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-raptor-500'} />
                                <span className={'min-w-0'}>
                                    <Point text={point} />
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {section.code?.map((block, i) => (
                    <CodeBlock key={i} label={block.label} content={block.content} />
                ))}
                {section.tips?.map((tip, i) => (
                    <div
                        key={i}
                        className={
                            'flex gap-3 rounded-lg p-3 bg-raptor-500/5 ring-1 ring-inset ring-raptor-500/20 text-sm text-raptor-50/90'
                        }
                    >
                        <LightBulbIcon className={'w-5 h-5 flex-shrink-0 text-raptor-400'} />
                        <span className={'min-w-0 leading-relaxed'}>
                            <Inline text={tip} />
                        </span>
                    </div>
                ))}
                {section.warning && (
                    <div
                        className={
                            'flex gap-3 rounded-lg p-3 bg-amber-500/5 ring-1 ring-inset ring-amber-500/25 text-sm text-amber-50/90'
                        }
                    >
                        <ExclamationIcon className={'w-5 h-5 flex-shrink-0 text-amber-400'} />
                        <span className={'min-w-0 leading-relaxed'}>
                            <Inline text={section.warning} />
                        </span>
                    </div>
                )}
            </motion.section>
        ))}
        {guide.faq && guide.faq.length > 0 && (
            <motion.section variants={item} className={'space-y-2'}>
                <h3 className={'text-base font-semibold text-gray-50'}>{t('Frequently asked')}</h3>
                {guide.faq.map((faq, i) => (
                    <Faq key={i} {...faq} />
                ))}
            </motion.section>
        )}
        {guide.related && guide.related.length > 0 && (
            <motion.section variants={item}>
                <h3 className={'text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2'}>
                    {t('Related guides')}
                </h3>
                <div className={'flex flex-wrap gap-2'}>
                    {guide.related
                        .map((key) => findGuide(key))
                        .filter((related): related is Guide => !!related)
                        .map((related) =>
                            onNavigate ? (
                                <button
                                    key={related.key}
                                    type={'button'}
                                    onClick={() => onNavigate(related.key)}
                                    className={
                                        'h-8 px-3 rounded-full text-xs font-medium bg-gray-800 text-gray-200 hover:bg-raptor-500/15 hover:text-white transition-colors'
                                    }
                                >
                                    {related.title}
                                </button>
                            ) : (
                                <Link
                                    key={related.key}
                                    to={`/admin/guides/${related.key}`}
                                    className={
                                        'inline-flex items-center h-8 px-3 rounded-full text-xs font-medium bg-gray-800 text-gray-200 hover:bg-raptor-500/15 hover:text-white no-underline transition-colors'
                                    }
                                >
                                    {related.title}
                                </Link>
                            )
                        )}
                </div>
            </motion.section>
        )}
    </motion.article>
);
