import { GeminiResponse } from './types';

const API_HOST = 'https://generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';

const API_KEY = () => process.env.GEMINI_API_KEY!;
const MODEL   = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Transient statuses worth retrying (rate limit / server / overloaded).
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Single HTTP wrapper for the Gemini REST API ─────────────────────────────
// Mirrors jira-client.ts: one fetch helper, unwraps the API error shape into a
// thrown Error so callers can `try/catch` uniformly. Transient 429/5xx responses
// are retried with exponential backoff (Gemini frequently returns a brief 503).
// `extraConfig` is merged into generationConfig (e.g. responseMimeType / responseSchema
// for forced-JSON output).
export async function generateContent(
  prompt: string,
  model = MODEL(),
  extraConfig: Record<string, unknown> = {}
): Promise<string> {
  const url = `${API_HOST}/${API_VERSION}/models/${model}:generateContent`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY(),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 8192,
          ...extraConfig,
        },
      }),
    });

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;

    if (!res.ok) {
      const message = body.error?.message || res.statusText;
      lastError = new Error(`Gemini ${res.status}: ${message}`);
      if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1)); // 0.5s, 1s, 2s
        continue;
      }
      throw lastError;
    }

    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') ?? '';

    if (!text.trim()) {
      const reason = candidate?.finishReason || body.promptFeedback?.blockReason || 'empty response';
      throw new Error(`Gemini returned no text (${reason})`);
    }

    return text.trim();
  }

  throw lastError ?? new Error('Gemini request failed');
}

// Convert a standard JSON Schema (lowercase types, additionalProperties) into
// Gemini's responseSchema shape (uppercase `type` enum, no additionalProperties).
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'additionalProperties') continue;
      if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
      else if (k === 'properties' && v && typeof v === 'object') {
        const props: Record<string, unknown> = {};
        for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) props[pk] = toGeminiSchema(pv);
        out.properties = props;
      } else if (k === 'items') out.items = toGeminiSchema(v);
      else out[k] = v; // enum, required, description, etc.
    }
    return out;
  }
  return node;
}

// ─── Structured JSON output ──────────────────────────────────────────────────
// Forces `responseMimeType: application/json` (plus an optional responseSchema) so
// Gemini returns parseable JSON. `schema` is a standard JSON Schema, converted to
// Gemini's shape here. Strips an accidental ```json fence just in case.
export async function generateJSON<T>(prompt: string, model = MODEL(), schema?: object): Promise<T> {
  const config: Record<string, unknown> = { responseMimeType: 'application/json' };
  if (schema) config.responseSchema = toGeminiSchema(schema);

  const raw = await generateContent(prompt, model, config);
  const cleaned = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error('Gemini did not return valid JSON');
  }
}
