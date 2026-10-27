import React from 'react';
import { BookOpenIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import { Drawer } from '@/components/admin/ui/Overlay';
import Button from '@/components/admin/ui/Button';
import GuideArticle from '@/components/admin/guides/GuideArticle';
import { useGuide } from '@/components/admin/guides/GuideContext';
import { findGuide } from '@/components/admin/guides';
import { t } from '@/i18n';

/** Shows the guide of the current page next to it, without leaving the page. */
export default () => {
    const { current, open, close } = useGuide();
    const guide = current ? findGuide(current) : undefined;

    return (
        <Drawer
            open={!!guide}
            onClose={close}
            wide
            icon={BookOpenIcon}
            title={guide?.title || ''}
            description={
                guide
                    ? t('{{category}} · {{minutes}} min read', { category: guide.category, minutes: guide.minutes })
                    : undefined
            }
            footer={
                <>
                    <Button variant={'ghost'} to={'/admin/guides'} icon={BookOpenIcon}>
                        {t('All guides')}
                    </Button>
                    {guide && (
                        <Button variant={'secondary'} to={`/admin/guides/${guide.key}`} icon={ExternalLinkIcon}>
                            {t('Open full page')}
                        </Button>
                    )}
                </>
            }
        >
            {guide && <GuideArticle key={guide.key} guide={guide} onNavigate={open} />}
        </Drawer>
    );
};
