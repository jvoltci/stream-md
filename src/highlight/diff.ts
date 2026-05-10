import type { HighlightToken } from "./highlighter";

/** Highlight a unified-diff. */
export function highlightDiff(code: string): HighlightToken[] {
  const out: HighlightToken[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push({ text: "\n", className: "" });
    const line = lines[i]!;
    if (line.startsWith("+++") || line.startsWith("---")) {
      out.push({ text: line, className: "smd-hl-info" });
    } else if (line.startsWith("+")) {
      out.push({ text: line, className: "smd-hl-inserted" });
    } else if (line.startsWith("-")) {
      out.push({ text: line, className: "smd-hl-deleted" });
    } else if (line.startsWith("@@")) {
      out.push({ text: line, className: "smd-hl-info" });
    } else {
      out.push({ text: line, className: "" });
    }
  }
  return out;
}
