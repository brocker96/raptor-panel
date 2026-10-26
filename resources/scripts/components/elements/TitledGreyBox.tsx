import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';

interface Props {
    icon?: IconProp;
    title: string | React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

const TitledGreyBox = ({ icon, title, children, className }: Props) => (
    <div css={tw`rounded-lg bg-gray-900/80 border border-gray-800 shadow-card`} className={className}>
        <div css={tw`px-4 py-3 border-b border-gray-800`}>
            {typeof title === 'string' ? (
                <p css={tw`text-sm font-semibold text-gray-100`}>
                    {icon && <FontAwesomeIcon icon={icon} css={tw`mr-2 text-raptor-400`} />}
                    {title}
                </p>
            ) : (
                title
            )}
        </div>
        <div css={tw`p-4`}>{children}</div>
    </div>
);

export default memo(TitledGreyBox, isEqual);
