import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Hard-guard: every file that uses React state/effects/browser APIs MUST
 * carry the `"use client"` banner so it works in Next.js App Router server
 * components. Files without state/effects (pure server) MUST NOT have it.
 */

const ROOT = resolve(__dirname, "../..");

const MUST_HAVE_USE_CLIENT = [
  "src/components/StreamMD.tsx",
  "src/hooks/useStreamMD.ts",
  "src/next/ai-sdk.tsx",
];

const MUST_NOT_HAVE_USE_CLIENT = [
  "src/server/index.ts",
  "src/next/StreamMDServer.tsx",
  "src/parser/StreamParser.ts",
  "src/parser/InlineParser.ts",
  "src/core/sanitize.ts",
];

describe("use-client banner", () => {
  for (const p of MUST_HAVE_USE_CLIENT) {
    it(`${p} declares "use client"`, () => {
      const content = readFileSync(resolve(ROOT, p), "utf8");
      expect(content.startsWith('"use client"')).toBe(true);
    });
  }

  for (const p of MUST_NOT_HAVE_USE_CLIENT) {
    it(`${p} does NOT declare "use client"`, () => {
      const content = readFileSync(resolve(ROOT, p), "utf8");
      expect(content.includes('"use client"')).toBe(false);
    });
  }
});
