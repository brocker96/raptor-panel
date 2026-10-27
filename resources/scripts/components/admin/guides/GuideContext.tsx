import React, { createContext, useContext, useState } from 'react';

interface GuideState {
    /** Key of the guide currently shown in the drawer. */
    current: string | null;
    open: (key: string) => void;
    close: () => void;
}

const GuideContext = createContext<GuideState>({ current: null, open: () => undefined, close: () => undefined });

export const GuideProvider = ({ children }: { children: React.ReactNode }) => {
    const [current, setCurrent] = useState<string | null>(null);

    return (
        <GuideContext.Provider value={{ current, open: setCurrent, close: () => setCurrent(null) }}>
            {children}
        </GuideContext.Provider>
    );
};

export const useGuide = () => useContext(GuideContext);
