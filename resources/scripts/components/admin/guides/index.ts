import { Guide, GuideCategory } from '@/components/admin/guides/types';
import start from '@/components/admin/guides/content/start';
import servers from '@/components/admin/guides/content/servers';
import infrastructure from '@/components/admin/guides/content/infrastructure';
import eggs from '@/components/admin/guides/content/eggs';
import access from '@/components/admin/guides/content/access';
import config from '@/components/admin/guides/content/config';
import operations from '@/components/admin/guides/content/operations';

export const guides: Guide[] = [...start, ...servers, ...infrastructure, ...eggs, ...access, ...config, ...operations];

export const categories: GuideCategory[] = [
    'Getting started',
    'Servers',
    'Infrastructure',
    'Nests & eggs',
    'Users & access',
    'Configuration',
    'Operations',
];

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
