"use client";

import * as React from "react";
import { StreamMD } from "../components/StreamMD";
import type { StreamMDProps } from "../parser/types";

/**
 * Vercel AI SDK message shape — narrow on what we actually use so we don't
 * pin to a specific AI SDK major version. Compatible with v3 and v4.
 */
export interface AISDKMessage {
  id?: string;
  role: "system" | "user" | "assistant" | "tool" | "data" | string;
  content?: string;
  /** AI SDK v4 introduced parts; we concatenate text parts. */
  parts?: Array<{ type: string; text?: string } | unknown>;
}

export interface AssistantMarkdownProps
  extends Omit<StreamMDProps, "text"> {
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
export function AssistantMarkdown({
  message,
  always = false,
  ...rest
}: AssistantMarkdownProps): React.JSX.Element | null {
  if (!always && message.role !== "assistant") return null;
  const text = extractText(message);
  return <StreamMD text={text} {...rest} />;
}

function extractText(m: AISDKMessage): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) {
    return m.parts
      .map((p) => {
        if (p && typeof p === "object" && "type" in p && (p as { type: string }).type === "text") {
          return (p as { text?: string }).text ?? "";
        }
        return "";
      })
      .join("");
  }
  return "";
}
