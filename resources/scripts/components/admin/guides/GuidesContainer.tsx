import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpenIcon, ClockIcon, SearchIcon } from '@heroicons/react/outline';
import { Page } from '@/components/admin/ui/Page';
import { Card } from '@/components/admin/ui/Card';
import { EmptyState } from '@/components/admin/ui/Feedback';
import { item } from '@/components/admin/ui/motion';
import GuideArticle from '@/components/admin/guides/GuideArticle';
import { categories, findGuide, guides, searchableText } from '@/components/admin/guides';
import { NotFound } from '@/components/elements/ScreenBlock';

const index = guides.map((guide) => ({ guide, text: searchableText(guide) }));

export const GuideHub = () => {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return guides;

        return index.filter(({ text }) => terms.every((term) => text.includes(term))).map(({ guide }) => guide);
    }, [query]);

    return (
        <Page
            title={'Guides'}
            icon={BookOpenIcon}
            description={`${guides.length} step by step guides covering every part of the admin area, from installing Wings to troubleshooting.`}
        >
            <motion.div variants={item} className={'relative max-w-xl'}>
                <SearchIcon className={'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500'} />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={'Search guides, e.g. "cloudflare", "allocation", "smtp"…'}
                    className={
                        'block w-full h-12 pl-12 pr-4 rounded-xl bg-gray-900/80 border-0 ring-1 ring-inset ring-gray-700 text-base text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500 shadow-card'
                    }
                />
            </motion.div>
            {results.length === 0 ? (
                <EmptyState icon={SearchIcon} title={'No guides found'} description={'Try a different search term.'} />
            ) : (
                categories
                    .filter((category) => results.some((guide) => guide.category === category))
                    .map((category) => (
                        <motion.section key={category} variants={item}>
                            <h2 className={'mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500'}>
                                {category}
                            </h2>
                            <div className={'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
                                {results
                                    .filter((guide) => guide.category === category)
                                    .map((guide) => (
                                        <motion.div
                                            key={guide.key}
                                            layout
                                            whileHover={{ y: -3 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        >
                                            <Link
                                                to={`/admin/guides/${guide.key}`}
                                                className={
                                                    'group flex flex-col h-full rounded-xl p-4 bg-gray-900/70 ring-1 ring-inset ring-gray-800 hover:ring-raptor-500/40 shadow-card no-underline transition-colors'
                                                }
                                            >
                                                <p
                                                    className={
                                                        'text-sm font-semibold text-gray-50 group-hover:text-white'
                                                    }
                                                >
                                                    {guide.title}
                                                </p>
                                                <p className={'mt-1 flex-1 text-xs text-gray-400 leading-relaxed'}>
                                                    {guide.summary}
                                                </p>
                                                <p className={'mt-3 flex items-center gap-1 text-2xs text-gray-500'}>
                                                    <ClockIcon className={'w-3.5 h-3.5'} /> {guide.minutes} min ·{' '}
                                                    {guide.sections.length} sections
                                                    {guide.faq?.length ? ` · ${guide.faq.length} FAQ` : ''}
                                                </p>
                                            </Link>
                                        </motion.div>
                                    ))}
                            </div>
                        </motion.section>
                    ))
            )}
        </Page>
    );
};

export const GuideView = () => {
    const { key } = useParams<{ key: string }>();
    const guide = findGuide(key || '');

    if (!guide) return <NotFound />;

    return (
        <Page
            key={guide.key}
            title={guide.title}
            icon={BookOpenIcon}
            crumbs={[{ label: 'Guides', to: '/admin/guides' }, { label: guide.category }]}
            description={`${guide.minutes} min read`}
        >
            <Card className={'max-w-3xl'}>
                <GuideArticle guide={guide} />
            </Card>
        </Page>
    );
};
