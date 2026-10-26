import React, { useState } from 'react';
import { Dialog, DialogProps, DialogWrapperContext, WrapperProps } from '@/components/elements/dialog';

function asDialog(
    initialProps?: WrapperProps
): <P extends {}>(C: React.ComponentType<P>) => React.FunctionComponent<P & DialogProps> {
    return function <P extends {}>(Component: React.ComponentType<P>) {
        return function ({ open, onClose, ...rest }: P & DialogProps) {
            const [props, setProps] = useState<WrapperProps>(initialProps || {});

            return (
                <DialogWrapperContext.Provider value={{ props, setProps, close: onClose }}>
                    <Dialog {...props} open={open} onClose={onClose}>
                        <Component {...(rest as unknown as P)} />
                    </Dialog>
                </DialogWrapperContext.Provider>
            );
        };
    };
}

export default asDialog;
