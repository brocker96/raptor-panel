import React, { useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileObjectRow from '@/components/server/files/FileObjectRow';

// Rows show a second line with the size and date on small screens.
const estimateRowHeight = () => (window.matchMedia('(max-width: 639px)').matches ? 58 : 37);

/**
 * Renders a directory listing, only mounting the rows that are actually visible on the screen. This
 * keeps the file manager fast for directories with thousands of files (plugin data, world regions,
 * logs) instead of limiting how many files can be displayed.
 */
const VirtualFileList = ({ files }: { files: FileObject[] }) => {
    const container = useRef<HTMLDivElement>(null);
    const [scrollMargin, setScrollMargin] = useState(0);

    // The list is part of the page and scrolls with the window, so the virtualizer has to know how
    // far from the top of the document the list starts.
    useLayoutEffect(() => {
        const update = () => {
            if (container.current) {
                setScrollMargin(container.current.getBoundingClientRect().top + window.scrollY);
            }
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(document.body);

        return () => observer.disconnect();
    }, []);

    const virtualizer = useWindowVirtualizer({
        count: files.length,
        estimateSize: estimateRowHeight,
        overscan: 10,
        scrollMargin,
        getItemKey: (index) => files[index].key,
    });

    const items = virtualizer.getVirtualItems();

    return (
        <div ref={container} className={'relative w-full'} style={{ height: virtualizer.getTotalSize() }}>
            <div
                className={'absolute top-0 left-0 w-full'}
                style={{ transform: `translateY(${(items[0]?.start ?? scrollMargin) - scrollMargin}px)` }}
            >
                {items.map((item) => (
                    <div key={item.key} data-index={item.index} ref={virtualizer.measureElement} className={'pb-px'}>
                        <FileObjectRow file={files[item.index]} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VirtualFileList;
