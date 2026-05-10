import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StreamParser } from "../../src/parser/StreamParser";

/**
 * Run the official CommonMark JSON spec against the hand-rolled parser.
 *
 * The hand-rolled parser is intentionally NOT 100% spec-compliant — for
 * that, use `stream-md/strict` (micromark). This test simply baselines
 * the current pass rate so regressions are visible.
 *
 * To enable: drop `commonmark.json` (downloadable from spec.commonmark.org)
 * into `tests/fixtures/commonmark.json`.
 */

const SPEC_PATH = resolve(__dirname, "../fixtures/commonmark.json");

interface SpecCase {
  markdown: string;
  html: string;
  example: number;
  section: string;
}

if (existsSync(SPEC_PATH)) {
  const cases: SpecCase[] = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

  describe("CommonMark spec — baseline", () => {
    let pass = 0;
    let total = 0;

    for (const c of cases) {
      total++;
      // We compare structural intent: did parsing not throw, did it produce
      // *some* blocks for non-empty input. Full HTML diff requires a renderer.
      try {
        const p = new StreamParser();
        p.push(c.markdown);
        const blocks = p.getBlocks();
        if (c.markdown.trim() === "" || blocks.length > 0) pass++;
      } catch {
        /* count as fail */
      }
    }

    it(`reports baseline pass rate (≥30%)`, () => {
      const rate = pass / total;
      // Loose threshold: this is just a smoke test — a real spec runner
      // requires HTML output comparison, which we don't generate.
      expect(rate).toBeGreaterThan(0.3);
    });
  });
} else {
  describe("CommonMark spec", () => {
    it.skip("commonmark.json not present — drop it in tests/fixtures/", () => {
      /* */
    });
  });
}
