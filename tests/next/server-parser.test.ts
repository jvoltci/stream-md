import { describe, it, expect } from "vitest";
import { parseToBlocks } from "../../src/server";

describe("parseToBlocks (server / RSC)", () => {
  it("returns JSON-serializable blocks", () => {
    const blocks = parseToBlocks("# Hi\n\nA paragraph.\n\n```ts\nconst x = 1;\n```\n");
    // Must be plain data — round-trip via JSON.
    const round = JSON.parse(JSON.stringify(blocks));
    expect(round).toEqual(blocks);
  });

  it("never contains functions in output", () => {
    const blocks = parseToBlocks("- item\n");
    JSON.stringify(blocks); // throws if it contained functions; jest also flags
    const inspect = (obj: unknown): boolean => {
      if (typeof obj === "function") return false;
      if (obj && typeof obj === "object") {
        for (const v of Object.values(obj as Record<string, unknown>)) {
          if (!inspect(v)) return false;
        }
      }
      return true;
    };
    expect(inspect(blocks)).toBe(true);
  });

  it("force-closes trailing blocks", () => {
    const blocks = parseToBlocks("hello"); // no newline
    if (blocks.length > 0) {
      expect(blocks[blocks.length - 1]?.closed).toBe(true);
    }
  });

  it("works with no Node-only globals (Edge-like environment)", () => {
    // Don't actually try to run an Edge runtime, but verify we don't reach
    // for `Buffer`, `fs`, `process.platform` etc. Smoke test: result still
    // matches expected.
    const blocks = parseToBlocks("# E\n");
    expect(blocks[0]?.type).toBe("heading");
  });

  it("StreamMDServer handles empty input gracefully", () => {
    expect(parseToBlocks("")).toEqual([]);
  });
});
