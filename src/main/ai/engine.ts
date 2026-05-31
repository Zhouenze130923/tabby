import { AIProvider, ChatMessage, ChatOptions, StreamChunk } from "./providers/base";

/**
 * AI dispatch engine
 * Maintains a registry of providers and routes chat/stream requests.
 */
class AIEngine {
  private providers = new Map<string, AIProvider>();
  private defaultProvider = "deepseek";

  /**
   * Register a provider by name.
   */
  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a registered provider by name.
   */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the default provider name.
   */
  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  /**
   * Set the default provider name.
   */
  setDefaultProvider(name: string): void {
    this.defaultProvider = name;
  }

  /**
   * Get all registered provider names.
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Send a chat completion request (non-streaming) to the specified provider.
   * Returns the text content of the response.
   */
  async chat(
    providerName: string,
    messages: ChatMessage[],
    opts?: ChatOptions
  ): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`AI provider "${providerName}" not registered`);
    }

    const response = await provider.chat(messages, opts);
    if (!response.ok) {
      let errBody = "";
      try {
        errBody = await response.text();
      } catch {}
      throw new Error(
        `Provider "${providerName}" returned ${response.status}: ${errBody}`
      );
    }

    // Parse response based on provider format
    const data = await response.json();
    if (providerName === "claude") {
      // Anthropic format: { content: [{ type: "text", text: "..." }] }
      return data.content?.[0]?.text || "";
    }
    // OpenAI / DeepSeek format: { choices: [{ message: { content: "..." } }] }
    return data.choices?.[0]?.message?.content || "";
  }

  /**
   * Start a streaming chat completion.
   * Returns an AsyncIterable of text/error chunks.
   */
  stream(
    providerName: string,
    messages: ChatMessage[],
    opts?: ChatOptions
  ): AsyncIterable<StreamChunk> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return (async function* () {
        yield { type: "error" as const, content: `AI provider "${providerName}" not registered` };
      })();
    }

    return provider.stream(messages, opts);
  }
}

/** Singleton engine instance */
export const aiEngine = new AIEngine();
