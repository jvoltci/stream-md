export { S as StreamMD, u as useStreamMD } from './useStreamMD-DnJOiZLu.js';
import * as React from 'react';
import { C as ComponentOverrides, I as InlinePlugin } from './types-CrKOFMtQ.js';
export { B as Block, a as BlockComponentProps, b as BlockMeta, c as BlockPlugin, d as BlockPluginOpenResult, e as BlockType, f as CodeBlockProps, D as DEFAULT_LIMITS, H as HighlighterFn, g as ImageProps, h as InlineCodeProps, i as InlinePluginMatchResult, j as InlineToken, k as InlineTokenType, L as Limits, l as LinkProps, m as ListBlockProps, P as ParseResult, S as StreamMDOptions, n as StreamMDProps, T as TableBlockProps } from './types-CrKOFMtQ.js';
export { S as StreamParser } from './StreamParser-BmMwTynp.js';
export { HighlightToken, SanitizeUrlOptions, highlight, highlightDiff, parseInline, sanitizeImageUrl, sanitizeUrl } from './core.js';
export { composePlugins, delimitedInlinePlugin, fencedBlockPlugin } from './plugins.js';

interface InlineRendererProps {
    text: string;
    overrides?: Partial<ComponentOverrides>;
    inlinePlugins?: InlinePlugin[];
    /** Disable speculative-close (used inside non-streaming contexts). */
    tentative?: boolean;
}
declare function InlineRenderer({ text, overrides, inlinePlugins, tentative, }: InlineRendererProps): React.JSX.Element;

export { ComponentOverrides, InlinePlugin, InlineRenderer };
