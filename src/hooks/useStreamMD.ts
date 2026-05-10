"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { StreamParser } from "../parser/StreamParser";
import type { Block, ParseResult, StreamMDOptions } from "../parser/types";

export interface UseStreamMDReturn {
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
export function useStreamMD(options?: StreamMDOptions): UseStreamMDReturn {
  const parserRef = useRef<StreamParser | null>(null);
  if (!parserRef.current) {
    parserRef.current = new StreamParser(options);
  }

  const [snapshot, setSnapshot] = useState<{
    blocks: Block[];
    activeIndex: number;
    incompleteLine: string;
  }>({ blocks: [], activeIndex: -1, incompleteLine: "" });

  const push = useCallback((fullText: string): void => {
    const parser = parserRef.current!;
    const result: ParseResult = parser.push(fullText);
    setSnapshot({
      blocks: result.blocks.slice(),
      activeIndex: result.activeIndex,
      incompleteLine: parser.getIncompleteLine(),
    });
  }, []);

  const reset = useCallback(() => {
    parserRef.current?.reset();
    setSnapshot({ blocks: [], activeIndex: -1, incompleteLine: "" });
  }, []);

  return useMemo(
    () => ({
      blocks: snapshot.blocks,
      activeIndex: snapshot.activeIndex,
      incompleteLine: snapshot.incompleteLine,
      push,
      reset,
    }),
    [snapshot, push, reset],
  );
}
