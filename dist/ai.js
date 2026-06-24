"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProvider = resolveProvider;
exports.providerEnvVar = providerEnvVar;
exports.modelLabel = modelLabel;
exports.generateText = generateText;
exports.generateJSON = generateJSON;
const gemini_client_1 = require("./gemini-client");
const claude_client_1 = require("./claude-client");
// ─── Provider dispatch ────────────────────────────────────────────────────────
// One place that decides which AI backend to call. `uac` and `epic` go through
// here so they stay provider-agnostic.
function resolveProvider(flag) {
    const raw = (flag ?? process.env.AI_PROVIDER ?? 'gemini').toLowerCase();
    return raw === 'claude' ? 'claude' : 'gemini';
}
function providerEnvVar(provider) {
    return provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
}
// Human-readable model label for logs (resolves the provider default when unset).
function modelLabel(provider, model) {
    if (model)
        return model;
    return provider === 'claude'
        ? process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
        : process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}
async function generateText(prompt, opts) {
    return opts.provider === 'claude'
        ? (0, claude_client_1.generateContent)(prompt, opts.model)
        : (0, gemini_client_1.generateContent)(prompt, opts.model);
}
// `schema` is a standard JSON Schema; the Gemini client converts it to Gemini's
// responseSchema shape internally, the Claude client uses it as-is.
async function generateJSON(prompt, opts) {
    return opts.provider === 'claude'
        ? (0, claude_client_1.generateJSON)(prompt, opts.model, opts.schema)
        : (0, gemini_client_1.generateJSON)(prompt, opts.model, opts.schema);
}
