"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = generateContent;
exports.generateJSON = generateJSON;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
// ─── Anthropic Claude provider (official SDK) ────────────────────────────────
// Parallel to gemini-client.ts, but uses `@anthropic-ai/sdk` rather than raw
// fetch. The SDK reads ANTHROPIC_API_KEY from the environment and retries
// transient 429/5xx automatically.
const DEFAULT_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
// Lazily constructed so the client is only created when the Claude provider is
// actually used (and after the API-key guard has run).
let _client = null;
function client() {
    if (!_client)
        _client = new sdk_1.default();
    return _client;
}
function extractText(content) {
    return content
        .filter((b) => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
}
// ─── Free-form text generation (used by `uac`) ───────────────────────────────
async function generateContent(prompt, model = DEFAULT_MODEL()) {
    const res = await client().messages.create({
        model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' }, // reasoning stays in (omitted) thinking blocks; text block is the clean answer
        messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal')
        throw new Error('Claude menolak permintaan (refusal).');
    const text = extractText(res.content);
    if (!text)
        throw new Error(`Claude returned no text (${res.stop_reason ?? 'empty'})`);
    return text;
}
// ─── Structured JSON output (used by `epic`) ─────────────────────────────────
// Uses structured outputs (output_config.format) with a standard JSON Schema so
// the response is guaranteed parseable. `schema` is a standard JSON Schema
// (lowercase types, additionalProperties:false).
async function generateJSON(prompt, model = DEFAULT_MODEL(), schema) {
    const build = (withSchema) => {
        const params = {
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }],
        };
        if (schema && withSchema) {
            // output_config is newer than some SDK type defs; attach untyped.
            params.output_config = {
                format: { type: 'json_schema', name: 'output', schema },
            };
        }
        return params;
    };
    let res;
    try {
        res = await client().messages.create(build(true));
    }
    catch (err) {
        // If structured outputs (output_config) is rejected by the API/SDK version,
        // fall back to prompt-driven JSON (the prompt already mandates JSON-only).
        if (schema && err instanceof sdk_1.default.BadRequestError) {
            res = await client().messages.create(build(false));
        }
        else {
            throw err;
        }
    }
    if (res.stop_reason === 'refusal')
        throw new Error('Claude menolak permintaan (refusal).');
    const text = extractText(res.content)
        .replace(/^```(?:json)?\s*\n/, '')
        .replace(/\n```\s*$/, '')
        .trim();
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error('Claude tidak mengembalikan JSON valid');
    }
}
