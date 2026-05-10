import { bench, describe } from "vitest";
import { StreamParser } from "../src/parser/StreamParser";

const SAMPLE = `# Streaming Test
A paragraph with **bold**, *italic*, and \`code\`.

\`\`\`ts
const x = 1;
const y = 2;
const z = x + y;
\`\`\`

- one
- two
- three

| a | b |
| - | - |
| 1 | 2 |
`;

describe("streaming — 1KB doc, char-by-char", () => {
  bench(
    "StreamParser, prefix-grow on every char",
    () => {
      const p = new StreamParser();
      let acc = "";
      for (let i = 0; i < SAMPLE.length; i++) {
        acc = SAMPLE.slice(0, i + 1);
        p.push(acc);
      }
    },
    { iterations: 50 },
  );
});
