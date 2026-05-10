import { bench, describe } from "vitest";
import { StreamParser } from "../src/parser/StreamParser";

const SAMPLE = `# Hello

This is **bold** and *italic*. Here's some \`inline code\` and a [link](https://example.com).

\`\`\`ts
function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
\`\`\`

| Col A | Col B | Col C |
| :---- | :---: | ----: |
| 1     | 2     | 3     |
| 4     | 5     | 6     |

- one
  - nested
- two
- three

> This is a blockquote.
> With multiple lines.

---

\`\`\`python
def hello():
    print("hi")
\`\`\`

More text after.
`;

describe("atomic parse — 1KB sample", () => {
  bench("stream-md StreamParser", () => {
    const p = new StreamParser();
    p.push(SAMPLE);
  });
});
