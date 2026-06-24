import { generateContent as geminiText, generateJSON as geminiJSON } from './gemini-client';
import { generateContent as claudeText, generateJSON as claudeJSON } from './claude-client';
import { Provider } from './types';

// ─── Provider dispatch ────────────────────────────────────────────────────────
// One place that decides which AI backend to call. `uac` and `epic` go through
// here so they stay provider-agnostic.

export function resolveProvider(flag?: string): Provider {
  const raw = (flag ?? process.env.AI_PROVIDER ?? 'gemini').toLowerCase();
  return raw === 'claude' ? 'claude' : 'gemini';
}

export function providerEnvVar(provider: Provider): string {
  return provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
}

// Human-readable model label for logs (resolves the provider default when unset).
export function modelLabel(provider: Provider, model?: string): string {
  if (model) return model;
  return provider === 'claude'
    ? process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
    : process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export async function generateText(prompt: string, opts: { provider: Provider; model?: string }): Promise<string> {
  return opts.provider === 'claude'
    ? claudeText(prompt, opts.model)
    : geminiText(prompt, opts.model);
}

// `schema` is a standard JSON Schema; the Gemini client converts it to Gemini's
// responseSchema shape internally, the Claude client uses it as-is.
export async function generateJSON<T>(
  prompt: string,
  opts: { provider: Provider; model?: string; schema?: object }
): Promise<T> {
  return opts.provider === 'claude'
    ? claudeJSON<T>(prompt, opts.model, opts.schema)
    : geminiJSON<T>(prompt, opts.model, opts.schema);
}
