import { AIProvider, ChatMessage, ChatOptions, StreamChunk } from "./base";

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * OpenAI-compatible provider
 * Works with OpenAI, Azure OpenAI, Ollama, LM Studio, or any OpenAI-compatible endpoint.
 */
export class OpenAIProvider implements AIProvider {
  name = "openai";
  private config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || "gpt-4o",
      baseUrl: (config.baseUrl || "https://api.openai.com").replace(
        /\/+$/,
        ""
      ),
    };
  }

  async chat(
    messages: ChatMessage[],
    opts?: ChatOptions
  ): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: opts?.model || this.config.model,
        messages,
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
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: opts?.model || this.config.model,
        messages,
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts?.signal,
    });

    if (!response.ok) {
      let errMsg = `OpenAI API error: ${response.status}`;
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
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              yield { type: "text", content };
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
}
