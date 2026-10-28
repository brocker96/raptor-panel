import PageContentBlock, { PageContentBlockProps } from '@/components/elements/PageContentBlock';
import React from 'react';
import { ServerContext } from '@/state/server';

interface Props extends PageContentBlockProps {
    title: string;
    /** Short explanation rendered below the page heading. */
    description?: React.ReactNode;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    /** Buttons rendered on the right of the heading (below it on phones). */
    actions?: React.ReactNode;
    /** Pages with their own header (e.g. the console) can hide the default heading. */
    hideHeading?: boolean;
}

const ServerContentBlock: React.FC<React.PropsWithChildren<Props>> = ({
    title,
    description,
    icon: Icon,
    actions,
    hideHeading,
    children,
    ...props
}) => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);

    return (
        <PageContentBlock title={`${name} | ${title}`} {...props}>
            {!hideHeading && (
                <div className={'mb-6 flex flex-col sm:flex-row sm:items-start gap-4'}>
                    <div className={'flex items-start gap-3.5 min-w-0 flex-1'}>
                        {Icon && (
                            <span
                                className={
                                    'hidden sm:grid place-items-center w-11 h-11 flex-shrink-0 rounded-xl bg-raptor-500/10 text-raptor-400 ring-1 ring-inset ring-raptor-500/20'
                                }
                            >
                                <Icon className={'w-5 h-5'} />
                            </span>
                        )}
                        <div className={'min-w-0'}>
                            <h1 className={'text-2xl sm:text-[1.7rem] font-semibold text-gray-50 break-words'}>
                                {title}
                            </h1>
                            {description && <div className={'mt-1 text-sm text-gray-400 max-w-2xl'}>{description}</div>}
                        </div>
                    </div>
                    {actions && <div className={'flex flex-wrap items-center gap-2 sm:flex-shrink-0'}>{actions}</div>}
                </div>
            )}
            {children}
        </PageContentBlock>
    );
};

export default ServerContentBlock;
