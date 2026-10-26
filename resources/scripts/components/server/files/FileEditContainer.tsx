import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { dirname } from 'pathe';
import classNames from 'classnames';
import { ArrowLeftIcon, CheckIcon, ReplyIcon, SearchIcon, MenuAlt2Icon, SaveIcon } from '@heroicons/react/outline';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import FileNameModal from '@/components/server/files/FileNameModal';
import FlashMessageRender from '@/components/FlashMessageRender';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { Dialog } from '@/components/elements/dialog';
import Editor, { EditorHandle } from '@/components/elements/editor/Editor';
import { findLanguageByFilename, languages, PLAIN_TEXT } from '@/components/elements/editor/languages';
import useFlash from '@/plugins/useFlash';
import { usePermissions } from '@/plugins/usePermissions';
import { usePersistedState } from '@/plugins/usePersistedState';
import { ServerContext } from '@/state/server';
import { encodePathSegments, hashToPath } from '@/helpers';
import styles from './editor.module.css';

const getNewFileDraftKey = (uuid: string, directory: string) => `pterodactyl:new-file:${uuid}:${directory}`;

const readDraft = (key?: string) => {
    try {
        return key ? sessionStorage.getItem(key) || '' : '';
    } catch {
        return '';
    }
};

const writeDraft = (key: string, value: string) => {
    try {
        if (value.length > 0) {
            sessionStorage.setItem(key, value);
        } else {
            sessionStorage.removeItem(key);
        }
    } catch {
        // Storage can be unavailable (private mode, quota exceeded), drafts are best effort.
    }
};

interface ToolbarButtonProps {
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
}

const ToolbarButton = ({ label, onClick, active, disabled, children }: ToolbarButtonProps) => (
    <button
        type={'button'}
        title={label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={classNames(styles.tool, { [styles.tool_active]: active })}
    >
        {children}
    </button>
);

export default () => {
    const { action } = useParams<{ action: string }>();
    const isNewFile = action === 'new';

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(!isNewFile);
    const [content, setContent] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [language, setLanguage] = useState(PLAIN_TEXT);
    const [lineWrapping, setLineWrapping] = usePersistedState<boolean>('editor:line_wrapping', true);

    const editor = useRef<EditorHandle>(null);
    const navigate = useNavigate();
    const { hash } = useLocation();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const [canCreate, canUpdate] = usePermissions(['file.create', 'file.update']);
    const { addError, clearFlashes } = useFlash();

    const filePath = hashToPath(hash);
    const filename = filePath.split('/').pop() || '';
    const directory = isNewFile ? filePath : dirname(filePath);
    const draftKey = isNewFile ? getNewFileDraftKey(uuid, directory) : undefined;
    const canSave = isNewFile ? canCreate : canUpdate;

    // Warn before leaving the page with unsaved changes, both for in-app navigation and for
    // closing or reloading the browser tab.
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            dirty &&
            !isNewFile &&
            currentLocation.pathname + currentLocation.hash !== nextLocation.pathname + nextLocation.hash
    );

    useEffect(() => {
        if (!dirty || isNewFile) return;

        const listener = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', listener);

        return () => window.removeEventListener('beforeunload', listener);
    }, [dirty, isNewFile]);

    useEffect(() => {
        setDirectory(directory);
    }, [directory, setDirectory]);

    useEffect(() => {
        if (!isNewFile) {
            setLanguage(findLanguageByFilename(filename)?.name || PLAIN_TEXT);
        }
    }, [filename, isNewFile]);

    useEffect(() => {
        if (draftKey) {
            setContent(readDraft(draftKey));
        }
    }, [draftKey]);

    useEffect(() => {
        if (isNewFile) return;

        setError('');
        setLoading(true);
        getFileContents(uuid, filePath)
            .then(setContent)
            .catch((error) => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [isNewFile, uuid, filePath]);

    useEffect(() => {
        if (!justSaved) return;

        const timeout = setTimeout(() => setJustSaved(false), 2000);

        return () => clearTimeout(timeout);
    }, [justSaved]);

    const save = async (name?: string) => {
        if (!editor.current || loading) {
            return;
        }

        setLoading(true);
        clearFlashes('files:view');

        let redirecting = false;

        try {
            const value = editor.current.getValue();

            await saveFileContents(uuid, name || filePath, value);

            editor.current.markClean();

            if (name) {
                if (draftKey) {
                    writeDraft(draftKey, '');
                }

                redirecting = true;
                navigate(`/server/${id}/files/edit#/${encodePathSegments(name.replace(/^\/+/, ''))}`);
                return;
            }

            setJustSaved(true);
        } catch (error) {
            console.error(error);
            addError({ message: httpErrorToHuman(error), key: 'files:view' });
        } finally {
            if (!redirecting) {
                setLoading(false);
            }
        }
    };

    const onSave = () => {
        if (!canSave) return;

        if (isNewFile) {
            setModalVisible(true);
        } else {
            save();
        }
    };

    const onChange = useCallback((value: string) => draftKey && writeDraft(draftKey, value), [draftKey]);

    if (action !== 'edit' && action !== 'new') {
        return <NotFound />;
    }

    if (error) {
        return <ServerError message={error} onBack={() => navigate(-1)} />;
    }

    return (
        <div className={styles.page}>
            <FlashMessageRender byKey={'files:view'} className={'mb-2 sm:mb-4 px-3 sm:px-0'} />
            <div className={styles.header}>
                <button
                    type={'button'}
                    className={styles.back}
                    aria-label={'Back to file manager'}
                    onClick={() => navigate(`/server/${id}/files#${encodePathSegments(directory)}`)}
                >
                    <ArrowLeftIcon className={'w-5 h-5'} />
                </button>
                <div className={styles.breadcrumbs}>
                    <ErrorBoundary>
                        <FileManagerBreadcrumbs withinFileEditor isNewFile={isNewFile} renderLeft={<></>} />
                    </ErrorBoundary>
                </div>
                <span
                    className={classNames(styles.status, { [styles.status_dirty]: dirty })}
                    title={dirty ? 'Unsaved changes' : 'All changes saved'}
                    aria-live={'polite'}
                >
                    {justSaved ? (
                        <>
                            <CheckIcon className={'w-4 h-4'} />
                            <span className={'hidden sm:inline'}>Saved</span>
                        </>
                    ) : dirty ? (
                        <span className={'hidden sm:inline'}>Unsaved changes</span>
                    ) : null}
                </span>
            </div>
            {filename.endsWith('.pteroignore') && (
                <div className={styles.notice}>
                    You&apos;re editing a <code>.pteroignore</code> file. Any files or directories listed in here will
                    be excluded from backups. Wildcards are supported by using an asterisk (<code>*</code>). You can
                    negate a prior rule by prepending an exclamation point (<code>!</code>).
                </div>
            )}
            <FileNameModal
                visible={modalVisible}
                onDismissed={() => setModalVisible(false)}
                onFileNamed={(name) => {
                    setModalVisible(false);
                    save(name);
                }}
            />
            <Dialog.Confirm
                open={blocker.state === 'blocked'}
                onClose={() => blocker.reset?.()}
                title={'Discard unsaved changes?'}
                confirm={'Discard changes'}
                onConfirmed={() => blocker.proceed?.()}
            >
                You have made changes to this file that have not been saved. If you leave this page those changes will
                be lost.
            </Dialog.Confirm>
            <div className={styles.editor_wrapper}>
                <SpinnerOverlay visible={loading} />
                <Editor
                    ref={editor}
                    className={styles.editor}
                    initialContent={content}
                    language={language}
                    lineWrapping={lineWrapping ?? true}
                    readOnly={!canSave}
                    onSave={onSave}
                    onDirtyChange={setDirty}
                    onChange={isNewFile ? onChange : undefined}
                />
            </div>
            <div className={styles.toolbar}>
                <div className={styles.tools}>
                    <ToolbarButton label={'Undo'} onClick={() => editor.current?.undo()}>
                        <ReplyIcon className={'w-5 h-5'} />
                    </ToolbarButton>
                    <ToolbarButton label={'Redo'} onClick={() => editor.current?.redo()}>
                        <ReplyIcon className={'w-5 h-5 -scale-x-100'} />
                    </ToolbarButton>
                    <ToolbarButton label={'Find & replace'} onClick={() => editor.current?.toggleSearch()}>
                        <SearchIcon className={'w-5 h-5'} />
                    </ToolbarButton>
                    <ToolbarButton
                        label={'Toggle line wrapping'}
                        active={lineWrapping ?? true}
                        onClick={() => setLineWrapping((value) => !(value ?? true))}
                    >
                        <MenuAlt2Icon className={'w-5 h-5'} />
                    </ToolbarButton>
                </div>
                <select
                    className={styles.language}
                    value={language}
                    aria-label={'Syntax highlighting language'}
                    onChange={(e) => setLanguage(e.currentTarget.value)}
                >
                    <option value={PLAIN_TEXT}>{PLAIN_TEXT}</option>
                    {languages.map((lang) => (
                        <option key={lang.name} value={lang.name}>
                            {lang.name.replace(/ files$/, '')}
                        </option>
                    ))}
                </select>
                {canSave && (
                    <button type={'button'} className={styles.save} onClick={onSave} disabled={loading}>
                        <SaveIcon className={'w-5 h-5 sm:hidden'} />
                        <span>{isNewFile ? 'Create File' : 'Save'}</span>
                        <kbd className={styles.shortcut}>Ctrl S</kbd>
                    </button>
                )}
            </div>
        </div>
    );
};
