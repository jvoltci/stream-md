import { S as StreamMDOptions, B as Block } from './types-CrKOFMtQ.cjs';
export { b as BlockMeta, e as BlockType } from './types-CrKOFMtQ.cjs';
export { S as StreamParser } from './StreamParser-C-qYqGUb.cjs';
import 'react';

/**
 * stream-md/server — RSC-safe server parser.
 *
 * Pure JS, no React, no DOM, no Node-only APIs. Runs in:
 *   - Node.js (server components, route handlers)
 *   - Edge runtime (Vercel Edge Functions, Cloudflare Workers)
 *   - Browsers / workers
 *
 * Returns plain `Block[]` data that is JSON-serializable, so it can cross
 * the RSC boundary without any "this is not a plain object" warnings.
 */

/**
 * One-shot parse: feed the entire markdown text and get the final blocks.
 *
 * Use this on the server when you have the full text already (e.g. a saved
 * assistant message) and want server-rendered HTML for first paint.
 */
declare function parseToBlocks(text: string, options?: StreamMDOptions): Block[];

export { Block, StreamMDOptions, parseToBlocks };
