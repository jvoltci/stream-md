export { S as StreamMD, u as useStreamMD } from './useStreamMD-DnJOiZLu.js';
export { parseToBlocks } from './server.js';
import * as React from 'react';
import { n as StreamMDProps } from './types-CrKOFMtQ.js';
export { B as Block, b as BlockMeta, c as BlockPlugin, e as BlockType, C as ComponentOverrides, H as HighlighterFn, I as InlinePlugin } from './types-CrKOFMtQ.js';
import './StreamParser-BmMwTynp.js';

interface StreamMDServerProps {
    text: string;
    className?: string;
    theme?: "dark" | "light" | "none";
}
/**
 * Server-rendered streaming markdown.
 *
 * Use this in RSC for the first paint of a saved assistant message — emits
 * pure HTML (no client JS needed). For *live* streaming, use the client
 * `<StreamMD>` from `stream-md` or `stream-md/next`.
 */
declare function StreamMDServer({ text, className, theme, }: StreamMDServerProps): React.JSX.Element;

/**
 * Vercel AI SDK message shape — narrow on what we actually use so we don't
 * pin to a specific AI SDK major version. Compatible with v3 and v4.
 */
interface AISDKMessage {
    id?: string;
    role: "system" | "user" | "assistant" | "tool" | "data" | string;
    content?: string;
    /** AI SDK v4 introduced parts; we concatenate text parts. */
    parts?: Array<{
        type: string;
        text?: string;
    } | unknown>;
}
interface AssistantMarkdownProps extends Omit<StreamMDProps, "text"> {
    message: AISDKMessage;
    /** Render even when role !== "assistant" (default false). */
    always?: boolean;
}
/**
 * Renders the assistant turn's markdown. Drops in directly under `messages.map`.
 *
 * @example
 * ```tsx
 * {messages.map((m) =>
 *   m.role === 'assistant'
 *     ? <AssistantMarkdown key={m.id} message={m} theme="dark" />
 *     : <UserMessage key={m.id}>{m.content}</UserMessage>
 * )}
 * ```
 */
declare function AssistantMarkdown({ message, always, ...rest }: AssistantMarkdownProps): React.JSX.Element | null;

export { AssistantMarkdown, StreamMDProps, StreamMDServer };
