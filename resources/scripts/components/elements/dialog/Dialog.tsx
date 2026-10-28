import React, { useState } from 'react';
import { CheckIcon, ExclamationIcon, InformationCircleIcon, ShieldExclamationIcon } from '@heroicons/react/outline';
import Modal, { ModalTone } from '@/components/ui/Modal';
import { DialogContext, IconPosition, RenderDialogProps } from './';

const icons = {
    danger: { icon: ShieldExclamationIcon, tone: 'danger' },
    warning: { icon: ExclamationIcon, tone: 'warning' },
    success: { icon: CheckIcon, tone: 'success' },
    info: { icon: InformationCircleIcon, tone: 'default' },
} as const;

/**
 * Legacy dialog API (Dialog, Dialog.Footer, Dialog.Icon) rendered with the shared modal, so every
 * dialog of the panel looks and behaves the same.
 */
export default ({ open, title, description, onClose, preventExternalClose, children }: RenderDialogProps) => {
    const [icon, setIcon] = useState<React.ReactNode>();
    const [footer, setFooter] = useState<React.ReactNode>();
    const [, setIconPosition] = useState<IconPosition>('title');

    const type = typeof icon === 'string' && icon in icons ? icons[icon as keyof typeof icons] : null;

    return (
        <DialogContext.Provider value={{ setIcon, setFooter, setIconPosition }}>
            <Modal
                open={open}
                onClose={onClose}
                busy={preventExternalClose}
                title={title}
                description={description}
                icon={type?.icon}
                tone={(type?.tone || 'default') as ModalTone}
                footer={footer}
            >
                {children}
            </Modal>
        </DialogContext.Provider>
    );
};
