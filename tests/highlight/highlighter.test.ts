import { describe, it, expect } from "vitest";
import { highlight } from "../../src/highlight/highlighter";
import { highlightDiff } from "../../src/highlight/diff";

describe("highlight — javascript", () => {
  it("classifies keywords", () => {
    const t = highlight("const x = 1", "js");
    expect(t.find((x) => x.text === "const")?.className).toBe("smd-hl-keyword");
  });

  it("classifies strings", () => {
    const t = highlight('const x = "hi"', "ts");
    expect(t.find((x) => x.text === '"hi"')?.className).toBe("smd-hl-string");
  });

  it("classifies template literals", () => {
    const t = highlight("const x = `hi`", "ts");
    expect(t.find((x) => x.text === "`hi`")?.className).toBe("smd-hl-string");
  });

  it("classifies numbers", () => {
    const t = highlight("const x = 42.5", "js");
    expect(t.find((x) => x.text === "42.5")?.className).toBe("smd-hl-number");
  });

  it("classifies builtins", () => {
    const t = highlight("console.log(1)", "js");
    expect(t.find((x) => x.text === "console")?.className).toBe("smd-hl-builtin");
  });

  it("does NOT highlight `return` after a dot", () => {
    const t = highlight("obj.return", "js");
    const ret = t.find((x) => x.text === "return");
    expect(ret?.className).not.toBe("smd-hl-keyword");
  });

  it("comments", () => {
    const t = highlight("// hi\nx", "ts");
    expect(t.find((x) => x.text === "// hi")?.className).toBe("smd-hl-comment");
  });

  it("multi-line block comments", () => {
    const t = highlight("/* a\nb */\nx", "ts");
    expect(t.find((x) => x.text.startsWith("/*"))?.className).toBe("smd-hl-comment");
  });
});

describe("highlight — python", () => {
  it("triple-quoted multi-line string", () => {
    const t = highlight('x = """a\nb"""', "py");
    const s = t.find((x) => x.text.startsWith('"""'));
    expect(s?.className).toBe("smd-hl-string");
  });

  it("classifies def", () => {
    const t = highlight("def foo():", "python");
    expect(t.find((x) => x.text === "def")?.className).toBe("smd-hl-keyword");
  });
});

describe("highlight — rust", () => {
  it("fn keyword", () => {
    const t = highlight("fn main() {}", "rust");
    expect(t.find((x) => x.text === "fn")?.className).toBe("smd-hl-keyword");
  });
});

describe("highlight — c/cpp", () => {
  it("c keywords (not aliased to Java)", () => {
    const t = highlight("int main() { return 0; }", "c");
    expect(t.find((x) => x.text === "int")?.className).toBe("smd-hl-keyword");
  });

  it("cpp namespace", () => {
    const t = highlight("namespace foo { }", "cpp");
    expect(t.find((x) => x.text === "namespace")?.className).toBe("smd-hl-keyword");
  });
});

describe("highlight — markdown", () => {
  it("highlights headings, code fences, lists", () => {
    const code = "# heading\n```js\nlet x;\n```\n- item\n";
    const t = highlight(code, "markdown");
    expect(t.length).toBeGreaterThan(0);
  });
});

describe("highlight — diff", () => {
  it("inserted/deleted/info", () => {
    const t = highlightDiff("@@ -1,2 +1,2 @@\n-old\n+new\n");
    expect(t.find((x) => x.className === "smd-hl-info")).toBeDefined();
    expect(t.find((x) => x.className === "smd-hl-deleted")).toBeDefined();
    expect(t.find((x) => x.className === "smd-hl-inserted")).toBeDefined();
  });
});

describe("highlight — unknown lang", () => {
  it("returns code as-is", () => {
    const t = highlight("anything goes", "klingon");
    expect(t.length).toBe(1);
    expect(t[0]?.className).toBe("");
  });
});

describe("highlight — perf basics", () => {
  it("doesn't pathologically slow on long lines", () => {
    const code = "x ".repeat(10_000);
    const start = Date.now();
    highlight(code, "ts");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
