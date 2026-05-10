"use client";

import { useChat } from "@ai-sdk/react";
import { AssistantMarkdown } from "stream-md/next";

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <main>
      <h1>stream-md · Next.js + AI SDK</h1>
      {messages.map((m) =>
        m.role === "assistant" ? (
          <AssistantMarkdown key={m.id} message={m} theme="dark" />
        ) : (
          <p className="user" key={m.id}>
            {m.content}
          </p>
        ),
      )}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something…"
        />
      </form>
    </main>
  );
}
