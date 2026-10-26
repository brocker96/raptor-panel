import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Based on the "Ayu Mirage" palette that the panel has historically used for its editor.
const colors = {
    background: '#070908',
    gutter: '#070908',
    foreground: '#cbccc6',
    muted: '#5c6773',
    selection: '#264d1a',
    activeLine: '#0f1411',
    cursor: '#6fe33f',
    accent: '#ffcc66',
    keyword: '#ffa759',
    string: '#bae67e',
    number: '#ffcc66',
    func: '#ffd580',
    type: '#73d0ff',
    tag: '#5ccfe6',
    attribute: '#ffd580',
    comment: '#5c6773',
    invalid: '#ff3333',
    operator: '#f29e74',
    property: '#f28779',
};

export const editorTheme = EditorView.theme(
    {
        '&': {
            color: colors.foreground,
            backgroundColor: colors.background,
            height: '100%',
            fontSize: 'var(--editor-font-size, 13px)',
        },
        '.cm-scroller': {
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: '1.6',
            overscrollBehavior: 'contain',
        },
        '.cm-content': {
            caretColor: colors.cursor,
            paddingBottom: '40vh',
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.cursor, borderLeftWidth: '2px' },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
            { backgroundColor: colors.selection },
        '.cm-activeLine': { backgroundColor: colors.activeLine },
        '.cm-activeLineGutter': { backgroundColor: colors.activeLine, color: colors.foreground },
        '.cm-gutters': {
            backgroundColor: colors.gutter,
            color: colors.muted,
            border: 'none',
        },
        '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px', minWidth: '2.5em' },
        '.cm-foldPlaceholder': {
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.foreground,
            margin: '0 0.25rem',
        },
        '.cm-selectionMatch': { backgroundColor: '#1f3a17' },
        '.cm-searchMatch': { backgroundColor: '#3eaf1655', outline: '1px solid #52d321' },
        '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#3eaf16aa' },
        '&.cm-focused .cm-matchingBracket': { backgroundColor: '#2c322f', outline: '1px solid #5c6773' },
        '.cm-trailingSpace': { backgroundColor: 'rgba(255, 51, 51, 0.25)' },
        '.cm-tooltip': {
            backgroundColor: '#131715',
            border: '1px solid #2c322f',
            borderRadius: '0.25rem',
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: colors.selection },
        // The search panel is restyled so that it remains usable on narrow touch screens.
        '.cm-panels': { backgroundColor: '#131715', color: colors.foreground },
        '.cm-panels.cm-panels-top': { borderBottom: '1px solid #2c322f' },
        '.cm-panels.cm-panels-bottom': { borderTop: '1px solid #2c322f' },
        '.cm-panel.cm-search': {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 2.25rem 0.5rem 0.5rem',
            fontFamily: 'inherit',
        },
        '.cm-panel.cm-search br': { display: 'none' },
        '.cm-panel.cm-search label': {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
        },
        '.cm-panel.cm-search [name=close]': {
            position: 'absolute',
            top: '0.375rem',
            right: '0.5rem',
            fontSize: '1.25rem',
            padding: '0.25rem',
            color: colors.foreground,
        },
        '.cm-textfield': {
            backgroundColor: colors.background,
            border: '1px solid #2c322f',
            borderRadius: '0.25rem',
            color: colors.foreground,
            padding: '0.375rem 0.5rem',
            margin: 0,
            fontSize: '16px',
            flex: '1 1 10rem',
            minWidth: 0,
        },
        '.cm-button': {
            backgroundImage: 'none',
            backgroundColor: '#2c322f',
            border: 'none',
            borderRadius: '0.25rem',
            color: colors.foreground,
            padding: '0.375rem 0.625rem',
            margin: 0,
            textTransform: 'capitalize',
        },
        '.cm-button:active': { backgroundColor: '#4d5550' },
        '@media (min-width: 640px)': {
            '.cm-textfield': { fontSize: '0.875rem', flex: '0 1 14rem' },
        },
    },
    { dark: true }
);

export const editorHighlightStyle = HighlightStyle.define([
    { tag: t.keyword, color: colors.keyword },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: colors.foreground },
    { tag: [t.propertyName], color: colors.property },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: colors.func },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: colors.number },
    // Keys in key/value files (server.properties, ini, ...) are tokenized as definitions.
    { tag: t.definition(t.variableName), color: colors.property },
    { tag: [t.definition(t.name), t.separator], color: colors.foreground },
    { tag: t.quote, color: colors.string },
    { tag: [t.typeName, t.className, t.namespace, t.self], color: colors.type },
    { tag: [t.number, t.changed, t.annotation, t.modifier], color: colors.number },
    { tag: [t.operator, t.operatorKeyword], color: colors.operator },
    { tag: [t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#95e6cb' },
    { tag: [t.meta, t.comment], color: colors.comment, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: colors.keyword },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: colors.number },
    { tag: [t.processingInstruction, t.string, t.inserted], color: colors.string },
    { tag: [t.tagName], color: colors.tag },
    { tag: [t.attributeName], color: colors.attribute },
    { tag: t.invalid, color: colors.invalid },
]);

export const editorHighlighting = syntaxHighlighting(editorHighlightStyle);
