import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { StreamParser } from "../../src/parser/StreamParser";
import type { Block } from "../../src/parser/types";

/**
 * The headline property: parsing a document by feeding it in arbitrary
 * chunks must yield the same final block AST as parsing it atomically.
 *
 * This is the correctness guarantee that makes "incremental streaming"
 * meaningful. A single counter-example here is a real bug.
 */

function parseAtomic(text: string): Block[] {
  const p = new StreamParser();
  p.push(text);
  // Force-close trailing blocks (atomic = "no more tokens coming").
  for (const b of p.getBlocks()) b.closed = true;
  return p.getBlocks();
}

function parseStreamed(text: string, chunks: number[]): Block[] {
  const p = new StreamParser();
  let acc = "";
  let pos = 0;
  for (const sz of chunks) {
    pos = Math.min(pos + sz, text.length);
    acc = text.slice(0, pos);
    p.push(acc);
  }
  // Final flush
  if (pos < text.length) p.push(text);
  for (const b of p.getBlocks()) b.closed = true;
  return p.getBlocks();
}

function normalize(blocks: Block[]) {
  return blocks.map((b) => ({
    type: b.type,
    content: b.content,
    closed: b.closed,
    meta: {
      ...b.meta,
      parsed: undefined, // cache, doesn't affect semantics
    },
  }));
}

const sampleDocs = [
  "# Hello\n\nWorld.\n",
  "```ts\nconst a = 1;\nconst b = 2;\n```\n",
  "- one\n- two\n- three\n",
  "| a | b |\n| --- | --- |\n| 1 | 2 |\n",
  "> quote\n> more quote\n",
  "Para 1.\n\nPara 2 has `code` and **bold**.\n",
  "1. ordered\n2. list\n3. items\n",
  "Setext\n======\n\nBody.\n",
  "---\n\nAfter HR.\n",
  "Mix `inline code` with [a link](https://example.com) and ~~strike~~.\n",
];

describe("Streaming equivalence", () => {
  for (const doc of sampleDocs) {
    it(`atomic == streamed for: ${JSON.stringify(doc.slice(0, 30))}…`, () => {
      const atomic = normalize(parseAtomic(doc));
      // Char-by-char streaming.
      const charByChar = normalize(parseStreamed(doc, Array(doc.length).fill(1)));
      expect(charByChar).toEqual(atomic);
    });
  }

  it("property: random chunk sizes preserve final AST", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...sampleDocs),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 50 }),
        (doc, chunks) => {
          const atomic = normalize(parseAtomic(doc));
          const streamed = normalize(parseStreamed(doc, chunks));
          return JSON.stringify(streamed) === JSON.stringify(atomic);
        },
      ),
      { numRuns: 200 },
    );
  });
});
