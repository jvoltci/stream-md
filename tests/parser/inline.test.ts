import { describe, it, expect } from "vitest";
import { parseInline } from "../../src/parser/InlineParser";

describe("parseInline — text", () => {
  it("plain text passes through", () => {
    const t = parseInline("hello world");
    expect(t).toEqual([{ type: "text", content: "hello world" }]);
  });

  it("backslash escapes", () => {
    const t = parseInline("a\\*b");
    expect(t.map((x) => x.content).join("")).toBe("a*b");
  });
});

describe("parseInline — bold/italic", () => {
  it("**bold**", () => {
    const t = parseInline("**hi**");
    expect(t[0]?.type).toBe("bold");
    expect(t[0]?.content).toBe("hi");
  });

  it("*italic*", () => {
    const t = parseInline("*hi*");
    expect(t[0]?.type).toBe("italic");
  });

  it("***bolditalic***", () => {
    const t = parseInline("***hi***");
    expect(t[0]?.type).toBe("bolditalic");
  });

  it("does not match across whitespace gaps in _emph_", () => {
    // _ requires word-boundary flank
    const t = parseInline("foo_bar_baz");
    // Conservative behavior: _bar_ embedded in alnum should not become italic
    expect(t.find((x) => x.type === "italic")).toBeUndefined();
  });

  it("emits tentative bold for unclosed **bo at trailing edge", () => {
    const t = parseInline("hello **bo");
    const last = t[t.length - 1];
    expect(last?.type).toBe("bold");
    expect(last?.tentative).toBe(true);
  });

  it("does not emit tentative across newline", () => {
    const t = parseInline("hello **bo\nmore");
    expect(t.some((x) => x.tentative)).toBe(false);
  });
});

describe("parseInline — code", () => {
  it("inline `code`", () => {
    const t = parseInline("a `c` b");
    expect(t.find((x) => x.type === "code")?.content).toBe("c");
  });

  it("strips one leading + trailing space when not all-space", () => {
    const t = parseInline("` x `");
    expect(t.find((x) => x.type === "code")?.content).toBe("x");
  });

  it("supports double backticks containing a single backtick", () => {
    const t = parseInline("``a`b``");
    expect(t.find((x) => x.type === "code")?.content).toBe("a`b");
  });

  it("falls back to tentative on unclosed", () => {
    const t = parseInline("foo `bar");
    const code = t.find((x) => x.type === "code");
    expect(code?.tentative).toBe(true);
  });
});

describe("parseInline — links", () => {
  it("[text](url)", () => {
    const t = parseInline("[hi](https://example.com)");
    const link = t[0];
    expect(link?.type).toBe("link");
    expect(link?.href).toBe("https://example.com");
  });

  it("supports balanced parens in URL", () => {
    const t = parseInline("[w](https://en.wikipedia.org/wiki/Foo_(bar))");
    expect(t[0]?.href).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("supports title", () => {
    const t = parseInline('[hi](https://x.com "Title")');
    expect(t[0]?.title).toBe("Title");
  });

  it("rejects javascript: URLs (XSS)", () => {
    const t = parseInline("[bad](javascript:alert(1))");
    // Renders as raw text or text-only, never a link
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });

  it("rejects vbscript:", () => {
    const t = parseInline("[x](vbscript:msgbox(1))");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });

  it("rejects data: URLs for links", () => {
    const t = parseInline("[x](data:text/html,<script>alert(1)</script>)");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });
});

describe("parseInline — images", () => {
  it("![alt](url)", () => {
    const t = parseInline("![cat](https://x.com/cat.png)");
    expect(t[0]?.type).toBe("image");
    expect(t[0]?.href).toBe("https://x.com/cat.png");
  });

  it("rejects javascript: image URLs", () => {
    const t = parseInline("![x](javascript:alert(1))");
    expect(t.find((x) => x.type === "image")).toBeUndefined();
  });

  it("allows data:image/png;base64", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const t = parseInline(`![tiny](${png})`);
    expect(t[0]?.href).toBe(png);
  });

  it("rejects data:text/html in image", () => {
    const t = parseInline("![x](data:text/html,<script>)");
    expect(t.find((x) => x.type === "image")).toBeUndefined();
  });
});

describe("parseInline — strikethrough", () => {
  it("~~deleted~~", () => {
    const t = parseInline("a ~~b~~ c");
    expect(t.find((x) => x.type === "strikethrough")?.content).toBe("b");
  });
});

describe("parseInline — autolinks", () => {
  it("<https://x.com>", () => {
    const t = parseInline("<https://x.com>");
    expect(t[0]?.type).toBe("link");
    expect(t[0]?.href).toBe("https://x.com");
  });

  it("<a@b.com>", () => {
    const t = parseInline("<jane@example.com>");
    expect(t[0]?.type).toBe("link");
    expect(t[0]?.href).toBe("mailto:jane@example.com");
  });

  it("rejects autolinks to javascript:", () => {
    const t = parseInline("<javascript:alert(1)>");
    expect(t.find((x) => x.type === "link")).toBeUndefined();
  });
});

describe("parseInline — limits", () => {
  it("respects maxDepth", () => {
    const text = "*".repeat(100) + "x" + "*".repeat(100);
    const t = parseInline(text, { maxDepth: 2 });
    // No throw, no infinite recursion.
    expect(Array.isArray(t)).toBe(true);
  });

  it("returns plain text at maxDepth", () => {
    const t = parseInline("**hi**", { depth: 99, maxDepth: 99 });
    expect(t).toEqual([{ type: "text", content: "**hi**" }]);
  });
});

describe("parseInline — hard break", () => {
  it("two trailing spaces + newline", () => {
    const t = parseInline("a  \nb");
    expect(t.find((x) => x.type === "br")).toBeDefined();
  });
});
