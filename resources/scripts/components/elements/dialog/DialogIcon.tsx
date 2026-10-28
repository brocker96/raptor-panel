import { useContext, useEffect } from 'react';
import { DialogContext, DialogIconProps } from './';

/** Selects the icon shown in the header of the surrounding dialog. */
export default ({ type, position }: DialogIconProps) => {
    const { setIcon, setIconPosition } = useContext(DialogContext);

    useEffect(() => {
        setIcon(type);
    }, [type]);

    useEffect(() => {
        setIconPosition(position);
    }, [position]);

    return null;
};
