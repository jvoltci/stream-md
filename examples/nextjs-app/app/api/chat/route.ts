import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: unknown };
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: messages as never,
  });
  return result.toDataStreamResponse();
}
