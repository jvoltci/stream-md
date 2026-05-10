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

import { StreamParser } from "../parser/StreamParser";
import type { Block, StreamMDOptions } from "../parser/types";

/**
 * One-shot parse: feed the entire markdown text and get the final blocks.
 *
 * Use this on the server when you have the full text already (e.g. a saved
 * assistant message) and want server-rendered HTML for first paint.
 */
export function parseToBlocks(
  text: string,
  options: StreamMDOptions = {},
): Block[] {
  const parser = new StreamParser(options);
  parser.push(text);
  // Force-close any trailing block so the result is fully finalized.
  const blocks = parser.getBlocks();
  for (const b of blocks) {
    if (!b.closed) {
      b.closed = true;
      // Note: caches not populated here to keep the function cheap; consumers
      // can call `parseTable(b.content)` etc. lazily.
    }
  }
  // Strip any non-serializable fields just to be safe.
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    content: b.content,
    closed: b.closed,
    meta: stripFunctions(b.meta) as Block["meta"],
  }));
}

function stripFunctions<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripFunctions) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "function") continue;
    out[k] = stripFunctions(v);
  }
  return out as T;
}

export { StreamParser } from "../parser/StreamParser";
export type { Block, BlockMeta, BlockType, StreamMDOptions } from "../parser/types";
