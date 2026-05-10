import { describe, it, expect } from "vitest";
import { sanitizeUrl, sanitizeImageUrl } from "../../src/core/sanitize";
import { parseInline } from "../../src/parser/InlineParser";

describe("sanitizeUrl", () => {
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:text/javascript,alert(1)",
  ])("rejects %s", (url) => {
    expect(sanitizeUrl(url)).toBeNull();
  });

  it.each([
    "https://example.com",
    "http://x.org",
    "mailto:a@b.com",
    "tel:+15551234",
    "/relative/path",
    "#fragment",
    "?query=1",
    "../up",
    "./same",
  ])("allows %s", (url) => {
    expect(sanitizeUrl(url)).not.toBeNull();
  });
});

describe("sanitizeImageUrl", () => {
  it("rejects mailto: for images", () => {
    expect(sanitizeImageUrl("mailto:a@b.com")).toBeNull();
  });

  it("allows valid data:image URIs", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(sanitizeImageUrl(png)).toBe(png);
  });

  it("rejects data:text URLs", () => {
    expect(sanitizeImageUrl("data:text/html,<script>")).toBeNull();
  });
});

describe("parseInline XSS regressions", () => {
  it("javascript: link → no link emitted", () => {
    const t = parseInline("[click](javascript:alert(1))");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });

  it("javascript: image → no image emitted", () => {
    const t = parseInline("![x](javascript:alert(1))");
    expect(t.find((x) => x.type === "image")).toBeUndefined();
  });

  it("control characters can't smuggle javascript:", () => {
    const t = parseInline("[x](java\tscript:alert(1))");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });

  it("autolink javascript rejected", () => {
    const t = parseInline("<javascript:alert(1)>");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });

  it("inline HTML <script> is rendered as text (not parsed by default)", () => {
    const t = parseInline("<script>alert(1)</script>");
    // Our parser doesn't recognize raw HTML inline; the angle brackets remain.
    const txt = t.map((x) => (x.type === "text" ? x.content : "")).join("");
    expect(txt).toContain("<script>");
  });

  it("recursion-bomb does not crash", () => {
    const evil = "*".repeat(2000) + "x" + "*".repeat(2000);
    expect(() => parseInline(evil)).not.toThrow();
  });

  it("oversized input is truncated by parser limits", () => {
    // (Limit-test on parser side is in block.test.ts; here we just ensure
    // the inline parser also doesn't blow up.)
    const huge = "a".repeat(500_000);
    expect(() => parseInline(huge)).not.toThrow();
  });
});
