import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { generateJSON } from './gemini-client';
import { EpicBreakdown } from './types';

export const DEFAULT_EPIC_OUTPUT_DIR = 'output-uac';

// JSON schema enforced on the Gemini response (OpenAPI subset used by Gemini).
const BREAKDOWN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    epic: {
      type: 'OBJECT',
      properties: {
        summary:     { type: 'STRING' },
        description: { type: 'STRING' },
      },
      required: ['summary', 'description'],
    },
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          summary:     { type: 'STRING' },
          description: { type: 'STRING' },
          issuetype:   { type: 'STRING', enum: ['Story', 'Task'] },
        },
        required: ['summary', 'description', 'issuetype'],
      },
    },
  },
  required: ['epic', 'tasks'],
};

// ─── Prompt builder ───────────────────────────────────────────────────────────
export function buildBreakdownPrompt(input: string, lang: string): string {
  const language = lang === 'id' ? 'Bahasa Indonesia' : 'English';

  return [
    'You are a senior product/engineering lead. Given the Epic description below, produce',
    'a clean JIRA Epic plus a breakdown of the concrete child issues needed to deliver it.',
    `Write all summaries and descriptions in ${language}.`,
    '',
    'Return JSON ONLY, matching this shape:',
    '{',
    '  "epic": { "summary": string, "description": string },',
    '  "tasks": [ { "summary": string, "description": string, "issuetype": "Story" | "Task" } ]',
    '}',
    '',
    'Rules:',
    '- `epic.summary`: a concise epic title. Prefer the pattern `[Feature] short title`.',
    '- `epic.description`: 2–4 sentences on the objective, scope, and success outcome.',
    '- `tasks`: 4–8 child issues that together fully deliver the epic. Each must be',
    '  independently actionable and non-overlapping. Order them logically (foundations first).',
    '- Use `"Story"` for user-facing capabilities, `"Task"` for technical/enabling work.',
    '- `task.summary`: short and specific (imperative). `task.description`: 1–3 sentences,',
    '  may include a short markdown bullet list of acceptance points (use `- ` bullets).',
    '- Do not invent product names, URLs, or credentials. Keep it grounded in the input.',
    '',
    '--- EPIC INPUT START ---',
    input.trim(),
    '--- EPIC INPUT END ---',
  ].join('\n');
}

// ─── Generate the breakdown via Gemini (structured JSON) ─────────────────────
export async function generateBreakdown(
  input: string,
  opts: { lang?: string; model?: string } = {}
): Promise<EpicBreakdown> {
  const text = input.trim();
  if (!text) throw new Error('Input kosong — berikan deskripsi epic.');

  const prompt = buildBreakdownPrompt(text, opts.lang ?? 'en');
  const result = await generateJSON<EpicBreakdown>(prompt, opts.model, BREAKDOWN_SCHEMA);

  if (!result?.epic?.summary || !Array.isArray(result.tasks) || result.tasks.length === 0) {
    throw new Error('Gemini tidak mengembalikan epic + tasks yang valid.');
  }
  // Normalise issue types to the supported set.
  result.tasks = result.tasks.map(t => ({
    ...t,
    issuetype: t.issuetype === 'Story' ? 'Story' : 'Task',
  }));
  return result;
}

// ─── Persist the generated plan as JSON (for review / re-use) ────────────────
export async function saveBreakdownPlan(
  breakdown: EpicBreakdown,
  outDir: string,
  timestamp: string
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const slug     = (breakdown.epic.summary.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)) || 'epic';
  const filePath = path.join(outDir, `epic-${slug}-${timestamp}.json`);
  await writeFile(filePath, JSON.stringify(breakdown, null, 2) + '\n', 'utf-8');
  return filePath;
}
