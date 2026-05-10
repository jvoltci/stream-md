import * as React from 'react';
import { n as StreamMDProps, S as StreamMDOptions, B as Block } from './types-CrKOFMtQ.js';

declare function StreamMD({ text, className, theme, components, onBlockComplete, limits, highlighter, blockPlugins, inlinePlugins, showCursor, }: StreamMDProps): React.JSX.Element;

interface UseStreamMDReturn {
    blocks: Block[];
    activeIndex: number;
    incompleteLine: string;
    /** Push the full accumulated text. The parser internally diffs. */
    push: (fullText: string) => void;
    /** Reset all parser state. */
    reset: () => void;
}
/**
 * React hook for streaming markdown parsing.
 *
 * Use this when you want full control over rendering (or are not in React's
 * happy path with `<StreamMD>` — e.g. when wiring an SSE source directly).
 */
declare function useStreamMD(options?: StreamMDOptions): UseStreamMDReturn;

export { StreamMD as S, useStreamMD as u };
