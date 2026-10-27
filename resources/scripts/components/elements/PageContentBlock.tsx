import React, { useEffect } from 'react';
import classNames from 'classnames';
import FlashMessageRender from '@/components/FlashMessageRender';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
}

/**
 * Wraps the content of a page. The surrounding layout (navigation, padding and width) is provided
 * by the application shell, this only sets the document title and renders flash messages.
 */
const PageContentBlock: React.FC<React.PropsWithChildren<PageContentBlockProps>> = ({
    title,
    showFlashKey,
    className,
    children,
}) => {
    useEffect(() => {
        if (title) {
            document.title = title;
        }
    }, [title]);

    return (
        <div className={'animate-fade-in'}>
            <div className={classNames('min-h-[50vh]', className)}>
                {showFlashKey && <FlashMessageRender byKey={showFlashKey} className={'mb-4'} />}
                {children}
            </div>
            <footer className={'mt-12 mb-2 text-center text-xs text-gray-600'}>
                <a
                    rel={'noopener nofollow noreferrer'}
                    href={'https://github.com/brocker96/raptor-panel'}
                    target={'_blank'}
                    className={'text-gray-500 hover:text-gray-300'}
                >
                    Raptor Panel
                </a>
                {' · based on '}
                <a
                    rel={'noopener nofollow noreferrer'}
                    href={'https://pterodactyl.io'}
                    target={'_blank'}
                    className={'text-gray-500 hover:text-gray-300'}
                >
                    Pterodactyl&reg;
                </a>
            </footer>
        </div>
    );
};

export default PageContentBlock;
