// ═══════════════════════════════════════════════════════════════
// StreamMD — useStreamMD Hook
// ═══════════════════════════════════════════════════════════════

import { useRef, useMemo, useCallback, useState } from "react";
import { StreamParser } from "../parser/StreamParser";
import type { Block, ParseResult, StreamMDOptions } from "../parser/types";

export interface UseStreamMDReturn {
  /** All parsed blocks */
  blocks: Block[];
  /** Index of the currently active (streaming) block */
  activeIndex: number;
  /** The current incomplete line (not yet committed to a block) */
  incompleteLine: string;
  /** Push the full accumulated text (we diff internally) */
  push: (fullText: string) => void;
  /** Reset all parser state */
  reset: () => void;
}

/**
 * React hook for streaming markdown parsing.
 * Accepts the full accumulated text on each call to `push()`.
 * Internally diffs to only process new tokens.
 *
 * @example
 * ```tsx
 * const { blocks, activeIndex, incompleteLine, push, reset } = useStreamMD();
 *
 * useEffect(() => {
 *   const sse = new EventSource('/api/chat');
 *   let text = '';
 *   sse.onmessage = (e) => {
 *     text += e.data;
 *     push(text);
 *   };
 *   return () => sse.close();
 * }, [push]);
 * ```
 */
export function useStreamMD(options?: StreamMDOptions): UseStreamMDReturn {
  const parserRef = useRef<StreamParser | null>(null);
  const [result, setResult] = useState<ParseResult & { incompleteLine: string }>({
    blocks: [],
    activeIndex: -1,
    incompleteLine: "",
  });

  // Lazily initialize parser
  if (!parserRef.current) {
    parserRef.current = new StreamParser(options);
  }

  const push = useCallback((fullText: string) => {
    const parser = parserRef.current!;
    const newResult = parser.push(fullText);
    // Create shallow copy to trigger React re-render
    setResult({
      blocks: [...newResult.blocks],
      activeIndex: newResult.activeIndex,
      incompleteLine: parser.getIncompleteLine(),
    });
  }, []);

  const reset = useCallback(() => {
    parserRef.current?.reset();
    setResult({ blocks: [], activeIndex: -1, incompleteLine: "" });
  }, []);

  return useMemo(
    () => ({
      blocks: result.blocks,
      activeIndex: result.activeIndex,
      incompleteLine: result.incompleteLine,
      push,
      reset,
    }),
    [result, push, reset]
  );
}



