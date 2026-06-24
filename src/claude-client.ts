import Anthropic from '@anthropic-ai/sdk';

// ─── Anthropic Claude provider (official SDK) ────────────────────────────────
// Parallel to gemini-client.ts, but uses `@anthropic-ai/sdk` rather than raw
// fetch. The SDK reads ANTHROPIC_API_KEY from the environment and retries
// transient 429/5xx automatically.

const DEFAULT_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Lazily constructed so the client is only created when the Claude provider is
// actually used (and after the API-key guard has run).
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
}

// ─── Free-form text generation (used by `uac`) ───────────────────────────────
export async function generateContent(prompt: string, model = DEFAULT_MODEL()): Promise<string> {
  const res = await client().messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' }, // reasoning stays in (omitted) thinking blocks; text block is the clean answer
    messages: [{ role: 'user', content: prompt }],
  });

  if (res.stop_reason === 'refusal') throw new Error('Claude menolak permintaan (refusal).');

  const text = extractText(res.content);
  if (!text) throw new Error(`Claude returned no text (${res.stop_reason ?? 'empty'})`);
  return text;
}

// ─── Structured JSON output (used by `epic`) ─────────────────────────────────
// Uses structured outputs (output_config.format) with a standard JSON Schema so
// the response is guaranteed parseable. `schema` is a standard JSON Schema
// (lowercase types, additionalProperties:false).
export async function generateJSON<T>(prompt: string, model = DEFAULT_MODEL(), schema?: object): Promise<T> {
  const build = (withSchema: boolean): Anthropic.MessageCreateParamsNonStreaming => {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    };
    if (schema && withSchema) {
      // output_config is newer than some SDK type defs; attach untyped.
      (params as unknown as Record<string, unknown>).output_config = {
        format: { type: 'json_schema', name: 'output', schema },
      };
    }
    return params;
  };

  let res;
  try {
    res = await client().messages.create(build(true));
  } catch (err) {
    // If structured outputs (output_config) is rejected by the API/SDK version,
    // fall back to prompt-driven JSON (the prompt already mandates JSON-only).
    if (schema && err instanceof Anthropic.BadRequestError) {
      res = await client().messages.create(build(false));
    } else {
      throw err;
    }
  }

  if (res.stop_reason === 'refusal') throw new Error('Claude menolak permintaan (refusal).');

  const text = extractText(res.content)
    .replace(/^```(?:json)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Claude tidak mengembalikan JSON valid');
  }
}
