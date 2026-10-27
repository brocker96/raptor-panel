export type GuideCategory =
    | 'Getting started'
    | 'Servers'
    | 'Infrastructure'
    | 'Nests & eggs'
    | 'Users & access'
    | 'Configuration'
    | 'Operations';

export interface GuideSection {
    heading: string;
    /** Introductory paragraph(s), separated by blank lines. */
    body?: string;
    /** Numbered, step by step instructions. */
    steps?: string[];
    /** Bullet list of facts, options or field descriptions ("Field — explanation"). */
    points?: string[];
    tips?: string[];
    warning?: string;
    code?: { label?: string; language?: string; content: string }[];
}

export interface Guide {
    key: string;
    title: string;
    category: GuideCategory;
    summary: string;
    /** Estimated reading time in minutes. */
    minutes: number;
    sections: GuideSection[];
    faq?: { q: string; a: string }[];
    related?: string[];
}
