import { describe, it, expect } from "vitest";
import { StreamParser } from "../../src/parser/StreamParser";

function parseAll(text: string) {
  const p = new StreamParser();
  p.push(text);
  return p.getBlocks();
}

describe("StreamParser — headings", () => {
  it("# H1", () => {
    const b = parseAll("# Hello\n");
    expect(b[0]?.type).toBe("heading");
    expect(b[0]?.meta.level).toBe(1);
    expect(b[0]?.content).toBe("Hello");
  });

  it("###### H6", () => {
    const b = parseAll("###### Six\n");
    expect(b[0]?.meta.level).toBe(6);
  });

  it("trailing # are stripped", () => {
    const b = parseAll("## Hi ##\n");
    expect(b[0]?.content).toBe("Hi");
  });

  it("setext H1 (===)", () => {
    const b = parseAll("Hello\n=====\n");
    expect(b[0]?.type).toBe("heading");
    expect(b[0]?.meta.level).toBe(1);
  });

  it("setext H2 (---)", () => {
    const b = parseAll("Hello\n---\n");
    expect(b[0]?.type).toBe("heading");
    expect(b[0]?.meta.level).toBe(2);
  });

  it("--- alone (no preceding paragraph) is HR", () => {
    const b = parseAll("\n---\n");
    expect(b[0]?.type).toBe("hr");
  });

  it("does NOT close heading mid-stream (line is incomplete)", () => {
    const p = new StreamParser();
    p.push("# Hel"); // no newline
    expect(p.getBlocks().length).toBe(0);
    expect(p.getIncompleteLine()).toBe("# Hel");
  });
});

describe("StreamParser — paragraphs", () => {
  it("simple paragraph", () => {
    const b = parseAll("hello world\n");
    expect(b[0]?.type).toBe("paragraph");
  });

  it("blank line closes block", () => {
    const b = parseAll("a\n\nb\n");
    expect(b).toHaveLength(2);
    expect(b[0]?.type).toBe("paragraph");
    expect(b[1]?.type).toBe("paragraph");
  });
});

describe("StreamParser — code fences", () => {
  it("``` ts ... ```", () => {
    const b = parseAll("```ts\nlet x = 1;\n```\n");
    expect(b[0]?.type).toBe("code");
    expect(b[0]?.meta.language).toBe("ts");
    expect(b[0]?.content).toBe("let x = 1;");
  });

  it("supports info-string attributes", () => {
    const b = parseAll('```python title="x.py"\npass\n```\n');
    expect(b[0]?.meta.language).toBe("python");
    expect(b[0]?.meta.attributes).toBe('title="x.py"');
  });

  it("supports tilde fences", () => {
    const b = parseAll("~~~\nx\n~~~\n");
    expect(b[0]?.type).toBe("code");
  });

  it("doesn't close on shorter fence", () => {
    const b = parseAll("````ts\n```\nstill in code\n````\n");
    expect(b[0]?.type).toBe("code");
    expect(b[0]?.content).toBe("```\nstill in code");
  });
});

describe("StreamParser — tables", () => {
  it("commits ONLY when separator row arrives", () => {
    const p = new StreamParser();
    p.push("| a | b |\n");
    expect(p.getBlocks()[0]?.type).toBe("paragraph");
    p.push("| a | b |\n| --- | --- |\n");
    expect(p.getBlocks()[0]?.type).toBe("table");
  });

  it("does NOT mistake a paragraph with | for a table", () => {
    const b = parseAll("Use a | b | c here\n");
    expect(b[0]?.type).toBe("paragraph");
  });

  it("captures alignment", async () => {
    const { parseTable } = await import("../../src/parser/StreamParser");
    const b = parseAll("| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n\n");
    expect(b[0]?.type).toBe("table");
    const parsed = parseTable(b[0]!.content);
    expect(parsed.alignments).toEqual(["left", "center", "right"]);
  });
});

describe("StreamParser — lists", () => {
  it("unordered", () => {
    const b = parseAll("- a\n- b\n");
    expect(b[0]?.type).toBe("list");
    expect(b[0]?.meta.ordered).toBe(false);
  });

  it("ordered", () => {
    const b = parseAll("1. a\n2. b\n");
    expect(b[0]?.meta.ordered).toBe(true);
    expect(b[0]?.meta.start).toBe(1);
  });

  it("task list", () => {
    const b = parseAll("- [ ] todo\n- [x] done\n");
    expect(b[0]?.type).toBe("list");
  });

  it("captures nested indent", () => {
    const b = parseAll("- a\n  - b\n  - c\n- d\n");
    expect(b[0]?.type).toBe("list");
  });
});

describe("StreamParser — blockquotes", () => {
  it("simple", () => {
    const b = parseAll("> hi\n");
    expect(b[0]?.type).toBe("blockquote");
  });
});

describe("StreamParser — HR", () => {
  it.each(["---", "***", "___", "- - -", "* * *"])(
    "%s is HR",
    (line) => {
      const b = parseAll("\n" + line + "\n");
      expect(b[0]?.type).toBe("hr");
    },
  );
});

describe("StreamParser — diff resilience", () => {
  it("appends on prefix grow", () => {
    const p = new StreamParser();
    p.push("hello");
    p.push("hello world");
    expect(p.getBlocks().length + (p.getIncompleteLine() ? 1 : 0)).toBeGreaterThan(0);
  });

  it("resets on non-prefix replace", () => {
    const p = new StreamParser();
    p.push("# Foo\n");
    p.push("# Bar\n"); // not a prefix
    const blocks = p.getBlocks();
    expect(blocks.find((b) => b.content === "Bar")).toBeDefined();
  });

  it("respects maxDocLength", () => {
    const huge = "a".repeat(2_000_000);
    const p = new StreamParser({ limits: { maxDocLength: 1000 } });
    p.push(huge);
    expect(p.getIncompleteLine().length + p.getBlocks().reduce((s, b) => s + b.content.length, 0)).toBeLessThanOrEqual(1000);
  });
});

describe("StreamParser — onBlockComplete", () => {
  it("fires on close", () => {
    const seen: string[] = [];
    const p = new StreamParser({
      onBlockComplete: (b) => seen.push(b.type),
    });
    p.push("# Hi\n\npara\n\n");
    expect(seen).toContain("heading");
    expect(seen).toContain("paragraph");
  });
});
