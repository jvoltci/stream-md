export { S as StreamMD, u as useStreamMD } from './useStreamMD-Qdkky13u.cjs';
import * as React from 'react';
import { C as ComponentOverrides, I as InlinePlugin } from './types-CrKOFMtQ.cjs';
export { B as Block, a as BlockComponentProps, b as BlockMeta, c as BlockPlugin, d as BlockPluginOpenResult, e as BlockType, f as CodeBlockProps, D as DEFAULT_LIMITS, H as HighlighterFn, g as ImageProps, h as InlineCodeProps, i as InlinePluginMatchResult, j as InlineToken, k as InlineTokenType, L as Limits, l as LinkProps, m as ListBlockProps, P as ParseResult, S as StreamMDOptions, n as StreamMDProps, T as TableBlockProps } from './types-CrKOFMtQ.cjs';
export { S as StreamParser } from './StreamParser-C-qYqGUb.cjs';
export { HighlightToken, SanitizeUrlOptions, highlight, highlightDiff, parseInline, sanitizeImageUrl, sanitizeUrl } from './core.cjs';
export { composePlugins, delimitedInlinePlugin, fencedBlockPlugin } from './plugins.cjs';

interface InlineRendererProps {
    text: string;
    overrides?: Partial<ComponentOverrides>;
    inlinePlugins?: InlinePlugin[];
    /** Disable speculative-close (used inside non-streaming contexts). */
    tentative?: boolean;
}
declare function InlineRenderer({ text, overrides, inlinePlugins, tentative, }: InlineRendererProps): React.JSX.Element;

export { ComponentOverrides, InlinePlugin, InlineRenderer };
