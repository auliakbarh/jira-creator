import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { generateText } from './ai';
import { UACOptions, UACResult, TicketInput } from './types';

export const DEFAULT_OUTPUT_DIR = 'output-uac';

// ─── Prompt builder ───────────────────────────────────────────────────────────
// Instructs Gemini to turn a feature/requirement into a JIRA ticket description
// that follows the house template in claude-planning/JIRA-TICKET-DESCRIPTION-TEMPLATE.md:
// a `[feature][sub] description` title, a Description block of resource links, and
// UAC scenarios written as numbered uppercase `# N. TITLE` Gherkin (GIVEN/WHEN/THEN)
// blocks with optional EN/ID copy tables and Figma image placeholders.
export function buildUACPrompt(input: string, lang: string): string {
  const language = lang === 'id' ? 'Bahasa Indonesia' : 'English';

  return [
    'You are a senior QA/Business Analyst. Produce a JIRA ticket description with clear,',
    'testable **User Acceptance Criteria (UAC)** for the requirement below.',
    `Write all prose (descriptions and the Given/When/Then clauses) in ${language},`,
    'and keep the Gherkin keywords GIVEN / AND / WHEN / THEN in UPPERCASE ENGLISH.',
    '',
    'Return a SINGLE Markdown document only. Do NOT wrap the whole document in a code fence.',
    'Follow this EXACT structure:',
    '',
    '1. A title line as a top-level heading using the pattern:',
    '   `# [feature_name][sub_feature_name] short description`',
    '   Examples: `# [Login] Integration`, `# [Home][Notification] Mark notification as read`.',
    '   Sub-feature is optional. This MUST be the first line of the document.',
    '',
    '2. A `## Description` section: a short bullet list giving a 1–2 sentence overview plus',
    '   placeholder links. Use these bullets, filling real values only if present in the input,',
    '   otherwise write `TBD` (never invent URLs):',
    '   - Overview: <1–2 sentences>',
    '   - Figma: TBD',
    '   - PRD / Confluence: TBD',
    '   - Postman: TBD',
    '   - API contract & path: TBD',
    '',
    '3. A `## User Acceptance Criteria (UAC)` section, followed by one block per scenario.',
    '   Each scenario block MUST be formatted exactly like this:',
    '   - A heading: `# N. SCENARIO TITLE IN UPPERCASE` (N is a sequential number starting at 1).',
    '   - Keep one Gherkin group (GIVEN→AND→WHEN→THEN→AND) as a SINGLE block: one clause per line,',
    '     NO blank line between clauses. End each clause with a comma except the final clause of the',
    '     group, which ends with a period. Example (note: NO blank lines inside the group):',
    '       GIVEN <precondition>,',
    '       AND <more preconditions>,',
    '       WHEN <action>,',
    '       THEN <expected outcome>,',
    '       AND <more outcomes>.',
    '   - Put a BLANK LINE only: between the heading and its block, before & after a table, and',
    '     before the image placeholder. A new WHEN/THEN group after a table is its own block.',
    '   - A bilingual table is REQUIRED for every user-facing text/label/message (buttons, titles,',
    '     copy, error messages) — one row per string:',
    '     `| EN | ID |` / `|---|---|` / `| <english copy> | <indonesian copy> |`',
    '   - End every UI-related scenario with the placeholder line on its own:',
    '     `[image-or-design-ui-from-figma](https://example-image.com)`',
    '',
    'Cover the realistic set of scenarios: the main happy path, alternate/entry-point flows,',
    'permission/auth states, loading state, and error handling — plus edge/negative cases.',
    'Be specific and measurable; avoid vague words like "fast" or "user-friendly".',
    'Infer reasonable details when the input is sparse, but do not invent product names or URLs.',
    '',
    '--- REQUIREMENT START ---',
    input.trim(),
    '--- REQUIREMENT END ---',
  ].join('\n');
}

// ─── Read input from a text/markdown file ────────────────────────────────────
export async function readUACInput(filePath: string): Promise<string> {
  const content = (await readFile(filePath, 'utf-8')).trim();
  if (!content) throw new Error(`File is empty: ${filePath}`);
  return content;
}

// ─── Normalize spacing so tables/placeholders always render ──────────────────
// Match the house template: each Gherkin group (GIVEN→AND→WHEN→THEN→AND) stays a
// SINGLE block (single newlines render as hardBreaks in ADF), and blank lines only
// separate blocks. We insert a blank line before/after headings, before a table
// start, before an image placeholder, before plain content right after a table, and
// before each GIVEN that opens a new scenario group — but NOT between the clauses of
// one group (no forced blank before WHEN/THEN).
export function tidyMarkdown(md: string): string {
  const isTable   = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isImg     = (l: string) => l.trim().startsWith('[image-or-design-ui-from-figma]');
  const isHeading = (l: string) => /^\s*#{1,6}\s/.test(l);
  // Only GIVEN opens a new Gherkin group; AND/WHEN/THEN stay attached to it.
  const isGiven   = (l: string) => /^\s*GIVEN\b/.test(l);

  const lines = md.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const prev = out.length ? out[out.length - 1] : '';
    const needBlankBefore =
      isHeading(line) ||                                               // heading start
      (isHeading(prev) && line.trim() !== '') ||                       // content right after a heading
      (isTable(line) && !isTable(prev)) ||                             // table block start
      isImg(line) ||                                                   // image placeholder
      isGiven(line) ||                                                 // new Gherkin group start
      (!isTable(line) && !isImg(line) && line.trim() !== '' && isTable(prev)); // content after a table

    if (needBlankBefore && prev.trim() !== '') out.push('');
    out.push(line);
  }

  return out.join('\n');
}

// ─── Generate UAC markdown via Gemini ────────────────────────────────────────
export async function generateUAC(opts: UACOptions): Promise<string> {
  const input = opts.input.trim();
  if (!input) throw new Error('Input kosong — berikan teks atau file yang berisi requirement.');

  const prompt = buildUACPrompt(input, opts.lang ?? 'en');
  let markdown = await generateText(prompt, { provider: opts.provider ?? 'gemini', model: opts.model });

  // Strip an accidental wrapping ```markdown fence if the model adds one.
  markdown = markdown.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '').trim();
  return tidyMarkdown(markdown);
}

// ─── Build a filesystem-safe filename from the UAC title ─────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'uac';
}

function extractTitle(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : 'uac';
}

// ─── Persist the UAC markdown to <outDir>/<slug>-<timestamp>.md ──────────────
export async function saveUAC(markdown: string, outDir: string, timestamp: string): Promise<UACResult> {
  await mkdir(outDir, { recursive: true });

  const slug     = slugify(extractTitle(markdown));
  const fileName = `${slug}-${timestamp}.md`;
  const filePath = path.join(outDir, fileName);

  await writeFile(filePath, markdown + '\n', 'utf-8');
  return { filePath, fileName, title: extractTitle(markdown) };
}

// ─── Split the UAC markdown into a JIRA summary + description ─────────────────
// The first `# ` heading is the ticket title (the `[feature][sub] …` line). The
// JIRA summary is that line's text; the description is everything after it.
export function splitUAC(markdown: string): { summary: string; description: string } {
  const lines = markdown.split('\n');
  const idx   = lines.findIndex(l => /^#\s+/.test(l));

  if (idx === -1) {
    const first = lines.find(l => l.trim()) ?? 'UAC';
    return { summary: first.trim().slice(0, 255), description: markdown.trim() };
  }

  const summary     = lines[idx].replace(/^#\s+/, '').trim().slice(0, 255);
  const description = lines.slice(idx + 1).join('\n').trim();
  return { summary, description };
}

// ─── Build a JIRA ticket template (bulk-compatible) from the UAC markdown ─────
export function buildTicketTemplate(
  markdown: string,
  opts: { issuetype: string; priority?: string; projectKey?: string }
): TicketInput {
  const { summary, description } = splitUAC(markdown);

  const ticket: TicketInput = {
    summary,
    description,
    issuetype: opts.issuetype,
  };
  if (opts.priority)   ticket.priority   = opts.priority;
  if (opts.projectKey) ticket.projectKey = opts.projectKey;
  return ticket;
}

// ─── Persist the ticket template as JSON next to the .md (same basename) ─────
// The result is consumable directly by `bulk <file.json>`.
export async function saveTicketTemplate(ticket: TicketInput, mdFilePath: string): Promise<string> {
  const jsonPath = mdFilePath.replace(/\.md$/, '.json');
  await writeFile(jsonPath, JSON.stringify(ticket, null, 2) + '\n', 'utf-8');
  return jsonPath;
}
