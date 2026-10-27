import React, { forwardRef, Suspense, lazy } from 'react';
import classNames from 'classnames';
import type { EditorHandle } from '@/components/elements/editor/Editor';
import { Skeleton } from '@/components/admin/ui/Feedback';

const Editor = lazy(() => import('@/components/elements/editor/Editor'));

interface Props {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: string;
    initialContent: string;
    language: string;
    height?: string;
    onSave?: () => void;
}

/** CodeMirror editor embedded in a form, read its value through the forwarded handle. */
const CodeField = forwardRef<EditorHandle, Props>(
    ({ label, description, error, initialContent, language, height = '16rem', onSave }, ref) => (
        <div className={'min-w-0'}>
            {label && <p className={'mb-1.5 text-xs font-medium text-gray-300'}>{label}</p>}
            <div
                className={classNames(
                    'rounded-lg overflow-hidden ring-1 ring-inset isolate [&_.cm-content]:!pb-4 [&_.cm-editor]:h-full',
                    error ? 'ring-rose-500/70' : 'ring-gray-700 focus-within:ring-raptor-500'
                )}
                style={{ height }}
            >
                <Suspense fallback={<Skeleton className={'h-full rounded-none'} />}>
                    <Editor
                        ref={ref}
                        className={'h-full'}
                        initialContent={initialContent}
                        language={language}
                        lineWrapping={false}
                        onSave={onSave}
                    />
                </Suspense>
            </div>
            {error ? (
                <p className={'mt-1.5 text-xs text-rose-300'}>{error}</p>
            ) : (
                description && <p className={'mt-1.5 text-xs text-gray-500 leading-relaxed'}>{description}</p>
            )}
        </div>
    )
);

export default CodeField;
