import React, { useContext } from 'react';
import { DialogContext } from './';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

export default ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div className={'px-6 py-3 bg-gray-950/50 border-t border-gray-800 flex items-center justify-end gap-3'}>
                {children}
            </div>
        );
    }, [children]);

    return null;
};
