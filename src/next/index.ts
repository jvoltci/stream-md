/**
 * stream-md/next — Next.js helpers.
 *
 * - `<StreamMD>`         re-export of the client component (carries "use client")
 * - `<StreamMDServer>`   RSC server component for first-paint server rendering
 * - `<AssistantMarkdown>` Vercel AI SDK message-shape adapter
 * - `parseToBlocks`      re-export of the server parser
 */

export { StreamMD } from "../components/StreamMD";
export { useStreamMD } from "../hooks/useStreamMD";
export { parseToBlocks } from "../server";
export { StreamMDServer } from "./StreamMDServer";
export { AssistantMarkdown } from "./ai-sdk";
export type {
  StreamMDProps,
  Block,
  BlockMeta,
  BlockType,
  ComponentOverrides,
  HighlighterFn,
  InlinePlugin,
  BlockPlugin,
} from "../parser/types";
