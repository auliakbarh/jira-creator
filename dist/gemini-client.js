"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = generateContent;
const API_HOST = 'https://generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';
const API_KEY = () => process.env.GEMINI_API_KEY;
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Transient statuses worth retrying (rate limit / server / overloaded).
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// ─── Single HTTP wrapper for the Gemini REST API ─────────────────────────────
// Mirrors jira-client.ts: one fetch helper, unwraps the API error shape into a
// thrown Error so callers can `try/catch` uniformly. Transient 429/5xx responses
// are retried with exponential backoff (Gemini frequently returns a brief 503).
async function generateContent(prompt, model = MODEL()) {
    const url = `${API_HOST}/${API_VERSION}/models/${model}:generateContent`;
    let lastError;
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
                },
            }),
        });
        const body = (await res.json().catch(() => ({})));
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
