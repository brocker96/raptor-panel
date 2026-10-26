import PageContentBlock, { PageContentBlockProps } from '@/components/elements/PageContentBlock';
import React from 'react';
import { ServerContext } from '@/state/server';

interface Props extends PageContentBlockProps {
    title: string;
    /** Short explanation rendered below the page heading. */
    description?: string;
    /** Pages with their own header (e.g. the console) can hide the default heading. */
    hideHeading?: boolean;
}

const ServerContentBlock: React.FC<React.PropsWithChildren<Props>> = ({
    title,
    description,
    hideHeading,
    children,
    ...props
}) => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);

    return (
        <PageContentBlock title={`${name} | ${title}`} {...props}>
            {!hideHeading && (
                <div className={'mb-6'}>
                    <h1 className={'text-2xl sm:text-3xl'}>{title}</h1>
                    {description && <p className={'mt-1 text-sm text-gray-400'}>{description}</p>}
                </div>
            )}
            {children}
        </PageContentBlock>
    );
};

export default ServerContentBlock;
