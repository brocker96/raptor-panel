import React, { useEffect, useRef, useState } from 'react';
import Spinner from '@/components/elements/Spinner';
import Modal from '@/components/ui/Modal';

export interface RequiredModalProps {
    visible: boolean;
    onDismissed: () => void;
    appear?: boolean;
    top?: boolean;
}

export interface ModalProps extends RequiredModalProps {
    dismissable?: boolean;
    closeOnEscape?: boolean;
    closeOnBackground?: boolean;
    showSpinnerOverlay?: boolean;
}

/** Full screen backdrop, used by the drop zone of the file manager. */
export const ModalMask = (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={'fixed inset-0 z-50 flex overflow-auto bg-black/70 backdrop-blur-[2px]'} />
);

/**
 * Compatibility wrapper for the older modal API (visible / onDismissed) that renders through the
 * shared modal, so every dialog of the panel looks and behaves the same, including the bottom
 * sheet on phones.
 */
const LegacyModal: React.FC<React.PropsWithChildren<ModalProps>> = ({
    visible,
    dismissable,
    showSpinnerOverlay,
    onDismissed,
    children,
}) => {
    const [open, setOpen] = useState(visible);
    const wasOpen = useRef(visible);

    useEffect(() => setOpen(visible), [visible]);

    // Like before, onDismissed fires once the closing animation has finished.
    useEffect(() => {
        const closed = wasOpen.current && !open;
        wasOpen.current = open;
        if (!closed) return undefined;

        const timeout = setTimeout(onDismissed, 200);

        return () => clearTimeout(timeout);
    }, [open]);

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            busy={dismissable === false || showSpinnerOverlay}
            size={'lg'}
        >
            <div className={'relative'}>
                {showSpinnerOverlay && (
                    <div className={'absolute -inset-2 z-20 grid place-items-center rounded-xl bg-gray-900/70'}>
                        <Spinner />
                    </div>
                )}
                {children}
            </div>
        </Modal>
    );
};

export default LegacyModal;
