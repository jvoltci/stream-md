// src/strict/index.ts
var StrictStreamParser = class {
  constructor(options = {}) {
    this.blocks = [];
    this.prevText = "";
    this.blockId = 0;
    this.micromarkPromise = null;
    this.gfmPromise = null;
    this.opts = options;
  }
  push(fullText) {
    if (fullText === this.prevText) {
      return { blocks: this.blocks, activeIndex: this.blocks.length - 1 };
    }
    this.prevText = fullText;
    void this.parseAsync(fullText);
    return { blocks: this.blocks, activeIndex: this.blocks.length - 1 };
  }
  /** Synchronous wait for the parse to finish. Use in tests. */
  async pushAsync(fullText) {
    this.prevText = fullText;
    await this.parseAsync(fullText);
    return { blocks: this.blocks, activeIndex: this.blocks.length - 1 };
  }
  getBlocks() {
    return this.blocks;
  }
  reset() {
    this.blocks = [];
    this.prevText = "";
  }
  async parseAsync(text) {
    if (!this.micromarkPromise) this.micromarkPromise = import('micromark');
    if (!this.gfmPromise) this.gfmPromise = import('micromark-extension-gfm');
    const [{ micromark }, gfmMod] = await Promise.all([
      this.micromarkPromise,
      this.gfmPromise
    ]);
    const gfm = gfmMod.gfm;
    const html = micromark(text, {
      allowDangerousHtml: false,
      extensions: [gfm()]
    });
    this.blocks = htmlToBlocks(html, () => "smd-strict-" + ++this.blockId);
    if (this.opts.onBlockComplete) {
      for (const b of this.blocks) if (b.closed) this.opts.onBlockComplete(b);
    }
  }
};
function htmlToBlocks(html, mkId) {
  const blocks = [];
  const re = /<(h[1-6]|p|pre|ul|ol|blockquote|table|hr)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<(hr)\s*\/?>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1] ?? m[3];
    const inner = m[2] ?? "";
    if (/^h[1-6]$/.test(tag)) {
      const meta = { level: parseInt(tag.slice(1), 10) };
      blocks.push({
        id: mkId(),
        type: "heading",
        content: stripTags(inner),
        closed: true,
        meta
      });
    } else if (tag === "p") {
      blocks.push({
        id: mkId(),
        type: "paragraph",
        content: stripTags(inner),
        closed: true,
        meta: {}
      });
    } else if (tag === "pre") {
      const codeMatch = inner.match(/<code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code>/);
      const language = codeMatch?.[1] ?? "";
      const content = decodeEntities(codeMatch?.[2] ?? inner);
      blocks.push({
        id: mkId(),
        type: "code",
        content,
        closed: true,
        meta: { language }
      });
    } else if (tag === "ul" || tag === "ol") {
      const itemRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g;
      const items = [];
      let im;
      while ((im = itemRe.exec(inner)) !== null) items.push(stripTags(im[1]));
      const ordered = tag === "ol";
      const meta = { ordered };
      blocks.push({
        id: mkId(),
        type: "list",
        content: items.map((t) => ordered ? `1. ${t}` : `- ${t}`).join("\n"),
        closed: true,
        meta
      });
    } else if (tag === "blockquote") {
      blocks.push({
        id: mkId(),
        type: "blockquote",
        content: stripTags(inner),
        closed: true,
        meta: {}
      });
    } else if (tag === "table") {
      blocks.push({
        id: mkId(),
        type: "table",
        content: htmlTableToMarkdown(inner),
        closed: true,
        meta: {}
      });
    } else if (tag === "hr") {
      blocks.push({
        id: mkId(),
        type: "hr",
        content: "",
        closed: true,
        meta: {}
      });
    }
  }
  return blocks;
}
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ""));
}
function decodeEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function htmlTableToMarkdown(html) {
  const rows = [];
  const rowRe = /<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const cellRe = /<t[hd](?:\s[^>]*)?>([\s\S]*?)<\/t[hd]>/g;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(rm[1])) !== null) cells.push(stripTags(cm[1]));
    rows.push(`| ${cells.join(" | ")} |`);
  }
  if (rows.length > 1) {
    const headerCells = rows[0].split("|").length - 2;
    rows.splice(1, 0, `| ${Array(headerCells).fill("---").join(" | ")} |`);
  }
  return rows.join("\n");
}

export { StrictStreamParser };
//# sourceMappingURL=strict.js.map
//# sourceMappingURL=strict.js.map