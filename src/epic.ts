import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { generateJSON } from './ai';
import { EpicBreakdown, Provider } from './types';

export const DEFAULT_EPIC_OUTPUT_DIR = 'output-uac';

// Standard JSON Schema enforced on the response. The Gemini client converts this
// to Gemini's responseSchema shape; the Claude client uses it as-is for
// structured outputs.
const BREAKDOWN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    epic: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary:     { type: 'string' },
        description: { type: 'string' },
      },
      required: ['summary', 'description'],
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary:     { type: 'string' },
          description: { type: 'string' },
          issuetype:   { type: 'string', enum: ['Story', 'Task'] },
        },
        required: ['summary', 'description', 'issuetype'],
      },
    },
  },
  required: ['epic', 'tasks'],
};

// ─── Prompt builder ───────────────────────────────────────────────────────────
// Every `description` (the epic AND each child) follows the house UAC template:
// a `## Description` resource block + a `## User Acceptance Criteria (UAC)` section
// of numbered uppercase `# N. TITLE` Gherkin scenarios. Descriptions are emitted as
// markdown and rendered to ADF by toADF on creation, so spacing matters: blank lines
// separate blocks, single newlines inside a Gherkin group become hardBreaks.
export function buildBreakdownPrompt(input: string, lang: string): string {
  const language = lang === 'id' ? 'Bahasa Indonesia' : 'English';

  return [
    'You are a senior product/engineering lead + QA/Business Analyst. Given the Epic description',
    'below, produce a clean JIRA Epic plus a breakdown of the concrete child issues needed to',
    'deliver it. EVERY `description` (the epic AND each child) MUST be a full UAC document that',
    'follows the house template.',
    `Write all prose in ${language}; keep Gherkin keywords GIVEN / AND / WHEN / THEN in UPPERCASE ENGLISH.`,
    '',
    'Return JSON ONLY, matching this shape:',
    '{',
    '  "epic": { "summary": string, "description": string },',
    '  "tasks": [ { "summary": string, "description": string, "issuetype": "Story" | "Task" } ]',
    '}',
    '',
    'Structure rules:',
    '- `epic.summary`: a concise epic title. Prefer the pattern `[Feature] short title`.',
    '- `task.summary`: short and specific (imperative).',
    '- `tasks`: 4–8 child issues that together fully deliver the epic. Each independently',
    '  actionable and non-overlapping. Order logically (foundations first).',
    '- Use `"Story"` for user-facing capabilities, `"Task"` for technical/enabling work.',
    '- Do not invent product names, URLs, or credentials. Keep it grounded in the input.',
    '',
    'EVERY `description` field MUST contain this markdown (NO `# title` line — the title lives in',
    '`summary`):',
    '',
    '  ## Description',
    '  - Overview: <1–2 sentences>',
    '  - Figma: TBD',
    '  - PRD / Confluence: TBD',
    '  - Postman: TBD',
    '  - API contract & path: TBD',
    '',
    '  ## User Acceptance Criteria (UAC)',
    '',
    '  # 1. SCENARIO TITLE IN UPPERCASE',
    '',
    '  GIVEN <precondition>,',
    '  AND <more preconditions>,',
    '  WHEN <action>,',
    '  THEN <expected outcome>,',
    '  AND <more outcomes>.',
    '',
    '  | EN | ID |',
    '  |---|---|',
    '  | <english copy> | <indonesian copy> |',
    '',
    '  [image-or-design-ui-from-figma](https://example-image.com)',
    '',
    'Formatting rules (match the template EXACTLY):',
    '- Keep one Gherkin group (GIVEN→AND→WHEN→THEN→AND) as a SINGLE block — one clause per line,',
    '  NO blank line between clauses. End each clause with a comma; the last clause with a period.',
    '- Put a BLANK LINE only: between a heading and its block, before & after a `| EN | ID |` table,',
    '  and before the `[image-...]` placeholder. A new WHEN/THEN group after a table is a separate block.',
    '- A `| EN | ID |` table is REQUIRED for every user-facing text/label/message (buttons, titles,',
    '  copy, error messages) — one table row per string.',
    '- For the epic: high-level / cross-cutting UAC (acceptance for the whole epic).',
    '- For each child: UAC specific to that capability — cover happy path, alternate flows,',
    '  permission/auth, loading state, error handling, and edge cases.',
    '- Be specific and measurable; avoid vague words like "fast" or "user-friendly".',
    '',
    '--- EPIC INPUT START ---',
    input.trim(),
    '--- EPIC INPUT END ---',
  ].join('\n');
}

// ─── Generate the breakdown (structured JSON, provider-agnostic) ─────────────
export async function generateBreakdown(
  input: string,
  opts: { lang?: string; model?: string; provider?: Provider } = {}
): Promise<EpicBreakdown> {
  const text = input.trim();
  if (!text) throw new Error('Input kosong — berikan deskripsi epic.');

  const prompt = buildBreakdownPrompt(text, opts.lang ?? 'en');
  const result = await generateJSON<EpicBreakdown>(prompt, {
    provider: opts.provider ?? 'gemini',
    model: opts.model,
    schema: BREAKDOWN_SCHEMA,
  });

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
