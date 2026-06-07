/**
 * Provider Bridge — shared AI provider access for main process modules.
 * Reuses the same provider resolution logic from IPC handlers.
 */
import { settings } from "../storage/db";
import { DeepSeekProvider } from "./providers/deepseek";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { AIProvider } from "./providers/base";

let _cachedProvider: any = null;
let _cachedName = "";

export function getProvider(providerName?: string): any {
  const providersRaw = settings.get("providers");
  const defaultProvider = settings.get("defaultProvider") || "deepseek";
  const name = providerName || defaultProvider;

  if (_cachedProvider && _cachedName === name) return _cachedProvider;

  let providers: Record<string, any> = {};
  if (providersRaw) {
    try { providers = JSON.parse(providersRaw); } catch {}
  }

  const config = providers[name];
  if (!config?.apiKey) {
    throw new Error(`Provider "${name}" 未配置，请在设置中添加 API Key`);
  }

  let provider: any;
  switch (name) {
    case "deepseek":
      provider = new DeepSeekProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
      break;
    case "claude":
      provider = new ClaudeProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
      break;
    case "openai":
      provider = new OpenAIProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
      break;
    default:
      throw new Error(`Unknown provider: ${name}`);
  }

  _cachedProvider = provider;
  _cachedName = name;
  return provider;
}

export function setProviderApi(name: string, apiKey: string, baseUrl?: string, model?: string): void {
  const providersRaw = settings.get("providers") || "{}";
  let providers: Record<string, any> = {};
  try { providers = JSON.parse(providersRaw); } catch {}
  providers[name] = { apiKey, baseUrl: baseUrl || "", model: model || "" };
  settings.set("providers", JSON.stringify(providers));
  _cachedProvider = null;
  _cachedName = "";
}
