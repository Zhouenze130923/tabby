export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface StreamChunk {
  type: "text" | "error";
  content: string;
}

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<Response>;
  stream(
    messages: ChatMessage[],
    opts?: ChatOptions
  ): AsyncIterable<StreamChunk>;
}
