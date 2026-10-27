import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState, Extension, Text } from '@codemirror/state';
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    highlightTrailingWhitespace,
    keymap,
    lineNumbers,
    rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import {
    closeSearchPanel,
    highlightSelectionMatches,
    openSearchPanel,
    search,
    searchKeymap,
    searchPanelOpen,
} from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { editorHighlighting, editorTheme } from '@/components/elements/editor/theme';
import { findLanguageByName } from '@/components/elements/editor/languages';
import { t } from '@/i18n';

export interface EditorHandle {
    getValue: () => string;
    focus: () => void;
    undo: () => void;
    redo: () => void;
    toggleSearch: () => void;
    /** Marks the current document as the saved state, used for tracking unsaved changes. */
    markClean: () => void;
}

export interface EditorProps {
    className?: string;
    initialContent: string;
    language: string;
    lineWrapping?: boolean;
    readOnly?: boolean;
    onSave?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    /** Called with the current contents of the editor, debounced while the user is typing. */
    onChange?: (value: string) => void;
}

const baseExtensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    highlightTrailingWhitespace(),
    search({ top: true }),
    editorTheme,
    editorHighlighting,
    EditorView.contentAttributes.of({
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        'aria-label': t('File contents'),
    }),
];

const Editor = forwardRef<EditorHandle, EditorProps>(
    ({ className, initialContent, language, lineWrapping = true, readOnly = false, ...props }, ref) => {
        const container = useRef<HTMLDivElement>(null);
        const view = useRef<EditorView | null>(null);
        const cleanDoc = useRef<Text>(Text.empty);
        const dirty = useRef(false);
        const changeTimeout = useRef<ReturnType<typeof setTimeout>>();
        const languageSupport = useRef<Extension>([]);
        const compartments = useRef({
            language: new Compartment(),
            wrapping: new Compartment(),
            readOnly: new Compartment(),
        });

        // Keep the latest props in a ref so the editor never has to be re-created, and so that
        // the keymap always calls the current save handler.
        const latest = useRef({ ...props, lineWrapping, readOnly });
        latest.current = { ...props, lineWrapping, readOnly };

        const updateDirty = (doc: Text) => {
            const next = !doc.eq(cleanDoc.current);
            if (next !== dirty.current) {
                dirty.current = next;
                latest.current.onDirtyChange?.(next);
            }
        };

        const createState = (doc: string) =>
            EditorState.create({
                doc,
                extensions: [
                    baseExtensions,
                    compartments.current.language.of(languageSupport.current),
                    compartments.current.wrapping.of(latest.current.lineWrapping ? EditorView.lineWrapping : []),
                    compartments.current.readOnly.of(EditorState.readOnly.of(latest.current.readOnly)),
                    keymap.of([
                        {
                            key: 'Mod-s',
                            preventDefault: true,
                            run: () => {
                                latest.current.onSave?.();
                                return true;
                            },
                        },
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...searchKeymap,
                        ...historyKeymap,
                        ...foldKeymap,
                        indentWithTab,
                    ]),
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return;

                        updateDirty(update.state.doc);

                        if (latest.current.onChange) {
                            clearTimeout(changeTimeout.current);
                            changeTimeout.current = setTimeout(
                                () => latest.current.onChange?.(update.state.doc.toString()),
                                300
                            );
                        }
                    }),
                ],
            });

        useImperativeHandle(ref, () => ({
            getValue: () => view.current?.state.doc.toString() ?? '',
            focus: () => view.current?.focus(),
            undo: () => view.current && undo(view.current),
            redo: () => view.current && redo(view.current),
            toggleSearch: () => {
                if (!view.current) return;

                if (searchPanelOpen(view.current.state)) {
                    closeSearchPanel(view.current);
                } else {
                    openSearchPanel(view.current);
                }
            },
            markClean: () => {
                if (!view.current) return;

                cleanDoc.current = view.current.state.doc;
                updateDirty(view.current.state.doc);
            },
        }));

        useEffect(() => {
            view.current = new EditorView({ state: createState(initialContent), parent: container.current! });
            cleanDoc.current = view.current.state.doc;

            return () => {
                clearTimeout(changeTimeout.current);
                view.current?.destroy();
                view.current = null;
            };
        }, []);

        // Replace the whole editor state whenever new content is loaded. This also resets the undo
        // history, so "Ctrl+Z" cannot remove the content that was just loaded from the server.
        useEffect(() => {
            const current = view.current;
            if (!current || current.state.doc.toString() === initialContent) return;

            current.setState(createState(initialContent));
            cleanDoc.current = current.state.doc;
            updateDirty(current.state.doc);
        }, [initialContent]);

        useEffect(() => {
            const description = findLanguageByName(language);
            const apply = (support: Extension) => {
                languageSupport.current = support;
                view.current?.dispatch({ effects: compartments.current.language.reconfigure(support) });
            };

            if (!description) {
                apply([]);
                return;
            }

            // Languages are loaded on demand so that they do not bloat the main bundle.
            let cancelled = false;
            description
                .load()
                .then((support) => !cancelled && apply(support))
                .catch(console.error);

            return () => {
                cancelled = true;
            };
        }, [language]);

        useEffect(() => {
            view.current?.dispatch({
                effects: compartments.current.wrapping.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
            });
        }, [lineWrapping]);

        useEffect(() => {
            view.current?.dispatch({
                effects: compartments.current.readOnly.reconfigure(EditorState.readOnly.of(readOnly)),
            });
        }, [readOnly]);

        return <div ref={container} className={className} />;
    }
);

Editor.displayName = 'Editor';

export default Editor;
