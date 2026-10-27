import { Guide, GuideCategory } from '@/components/admin/guides/types';
import { t } from '@/i18n';
import start from '@/components/admin/guides/content/start';
import servers from '@/components/admin/guides/content/servers';
import infrastructure from '@/components/admin/guides/content/infrastructure';
import eggs from '@/components/admin/guides/content/eggs';
import access from '@/components/admin/guides/content/access';
import config from '@/components/admin/guides/content/config';
import operations from '@/components/admin/guides/content/operations';

/** Translates every text of a guide, the English text is the key like everywhere else. */
const localize = (guide: Guide): Guide => ({
    ...guide,
    title: t(guide.title),
    summary: t(guide.summary),
    category: t(guide.category) as GuideCategory,
    sections: guide.sections.map((section) => ({
        ...section,
        heading: t(section.heading),
        body: section.body && t(section.body),
        steps: section.steps?.map((step) => t(step)),
        points: section.points?.map((point) => t(point)),
        tips: section.tips?.map((tip) => t(tip)),
        warning: section.warning && t(section.warning),
        code: section.code?.map((block) => ({ ...block, label: block.label && t(block.label) })),
    })),
    faq: guide.faq?.map((item) => ({ q: t(item.q), a: t(item.a) })),
});

export const guides: Guide[] = [
    ...start,
    ...servers,
    ...infrastructure,
    ...eggs,
    ...access,
    ...config,
    ...operations,
].map(localize);

export const categories: GuideCategory[] = (<GuideCategory[]>[
    'Getting started',
    'Servers',
    'Infrastructure',
    'Nests & eggs',
    'Users & access',
    'Configuration',
    'Operations',
]).map((category) => t(category) as GuideCategory);

export const findGuide = (key: string): Guide | undefined => guides.find((guide) => guide.key === key);

/** Flattens a guide into lower case text for the search on the guide hub. */
export const searchableText = (guide: Guide): string =>
    [
        guide.title,
        guide.summary,
        ...guide.sections.flatMap((section) => [
            section.heading,
            section.body,
            ...(section.steps || []),
            ...(section.points || []),
            ...(section.tips || []),
            section.warning,
        ]),
        ...(guide.faq || []).flatMap((item) => [item.q, item.a]),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
