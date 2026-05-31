import { AIProvider, ChatMessage, ChatOptions, StreamChunk } from "./base";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Anthropic Claude provider — uses the Messages API
 * Docs: https://docs.anthropic.com/en/api/messages
 */
export class ClaudeProvider implements AIProvider {
  name = "claude";
  private config: Required<ClaudeConfig>;

  constructor(config: ClaudeConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || "claude-sonnet-4-20250514",
      baseUrl: (config.baseUrl || "https://api.anthropic.com").replace(
        /\/+$/,
        ""
      ),
    };
  }

  async chat(
    messages: ChatMessage[],
    opts?: ChatOptions
  ): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const { system, bodyMessages } = this.splitSystem(messages);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts?.model || this.config.model,
        messages: bodyMessages,
        ...(system ? { system } : {}),
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
        stream: false,
      }),
      signal: opts?.signal,
    });
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const { system, bodyMessages } = this.splitSystem(messages);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts?.model || this.config.model,
        messages: bodyMessages,
        ...(system ? { system } : {}),
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts?.signal,
    });

    if (!response.ok) {
      let errMsg = `Claude API error: ${response.status}`;
      try {
        const errBody = await response.text();
        errMsg += ` — ${errBody}`;
      } catch {}
      yield { type: "error", content: errMsg };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            switch (event.type) {
              case "content_block_delta":
                if (
                  event.delta?.type === "text_delta" &&
                  event.delta.text
                ) {
                  yield { type: "text", content: event.delta.text };
                }
                break;
              case "error":
                yield {
                  type: "error",
                  content: event.error?.message || "Claude API error",
                };
                return;
              case "message_stop":
                return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Split system messages from the rest — Claude uses a separate `system` parameter
   */
  private splitSystem(messages: ChatMessage[]) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    const bodyMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    return { system, bodyMessages };
  }
}
