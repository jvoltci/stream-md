import { S as StreamMDOptions, P as ParseResult, B as Block } from './types-CrKOFMtQ.js';
import 'react';

/**
 * stream-md/strict — opt-in CommonMark + GFM compliant adapter.
 *
 * Wraps `micromark` for spec-correct parsing. Slower and larger than the
 * default hand-rolled parser, but passes the full CommonMark + GFM test
 * suites. Loaded lazily so users who don't import this entry pay nothing.
 *
 * @example
 * ```ts
 * import { StrictStreamParser } from 'stream-md/strict';
 *
 * const parser = new StrictStreamParser();
 * parser.push(text);
 * const blocks = parser.getBlocks();
 * ```
 */

/**
 * Strict parser — same `push() / getBlocks() / reset()` interface as
 * `StreamParser`, but uses micromark internally for spec compliance.
 *
 * Implementation note: micromark is async to load, so the first `push()`
 * after construction triggers a one-time async init. Until init resolves,
 * `getBlocks()` returns whatever the previous (synchronous) parse produced.
 */
declare class StrictStreamParser {
    private blocks;
    private prevText;
    private blockId;
    private opts;
    private micromarkPromise;
    private gfmPromise;
    constructor(options?: StreamMDOptions);
    push(fullText: string): ParseResult;
    /** Synchronous wait for the parse to finish. Use in tests. */
    pushAsync(fullText: string): Promise<ParseResult>;
    getBlocks(): Block[];
    reset(): void;
    private parseAsync;
}

export { StrictStreamParser };
