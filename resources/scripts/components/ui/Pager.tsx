import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/outline';
import Button from '@/components/admin/ui/Button';
import { t } from '@/i18n';

/** Previous and next buttons with the current page, hidden when everything fits on one page. */
const Pager = ({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) => {
    if (total <= 1) return null;

    return (
        <div className={'mt-4 flex items-center justify-center gap-2 text-sm text-gray-400'}>
            <Button
                variant={'ghost'}
                size={'sm'}
                icon={ChevronLeftIcon}
                aria-label={t('Previous page')}
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
            />
            <span className={'tabular-nums px-2'}>{t('Page {{page}} of {{total}}', { page, total })}</span>
            <Button
                variant={'ghost'}
                size={'sm'}
                icon={ChevronRightIcon}
                aria-label={t('Next page')}
                disabled={page >= total}
                onClick={() => onChange(page + 1)}
            />
        </div>
    );
};

export default Pager;
