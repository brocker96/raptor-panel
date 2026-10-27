import React from 'react';
import { Dialog, RenderDialogProps } from './';
import { Button } from '@/components/elements/button/index';
import { t } from '@/i18n';

type ConfirmationProps = Omit<RenderDialogProps, 'description' | 'children'> & {
    children: React.ReactNode;
    confirm?: string | undefined;
    onConfirmed: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
};

export default ({ confirm = t('Okay'), children, onConfirmed, ...props }: ConfirmationProps) => {
    return (
        <Dialog {...props} description={typeof children === 'string' ? children : undefined}>
            {typeof children !== 'string' && children}
            <Dialog.Footer>
                <Button.Text onClick={props.onClose}>{t('Cancel')}</Button.Text>
                <Button.Danger onClick={onConfirmed}>{confirm}</Button.Danger>
            </Dialog.Footer>
        </Dialog>
    );
};
