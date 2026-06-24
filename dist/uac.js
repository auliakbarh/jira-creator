"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OUTPUT_DIR = void 0;
exports.buildUACPrompt = buildUACPrompt;
exports.readUACInput = readUACInput;
exports.tidyMarkdown = tidyMarkdown;
exports.generateUAC = generateUAC;
exports.slugify = slugify;
exports.saveUAC = saveUAC;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const gemini_client_1 = require("./gemini-client");
exports.DEFAULT_OUTPUT_DIR = 'output-uac';
// ─── Prompt builder ───────────────────────────────────────────────────────────
// Instructs Gemini to turn a feature/requirement into a JIRA ticket description
// that follows the house template in claude-planning/JIRA-TICKET-DESCRIPTION-TEMPLATE.md:
// a `[feature][sub] description` title, a Description block of resource links, and
// UAC scenarios written as numbered uppercase `# N. TITLE` Gherkin (GIVEN/WHEN/THEN)
// blocks with optional EN/ID copy tables and Figma image placeholders.
function buildUACPrompt(input, lang) {
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
        '   - Gherkin clauses, one per line. Put a BLANK LINE before each GIVEN, WHEN, and THEN',
        '     so each of those blocks begins on a new line (AND clauses stay attached to the block',
        '     above them). End each clause with a comma except the final clause of the scenario,',
        '     which ends with a period. Example (note the blank lines):',
        '       GIVEN <precondition>,',
        '       AND <more preconditions>,',
        '',
        '       WHEN <action>,',
        '',
        '       THEN <expected outcome>,',
        '       AND <more outcomes>.',
        '   - When the scenario shows user-facing copy/text, include a bilingual table right after it:',
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
async function readUACInput(filePath) {
    const content = (await (0, promises_1.readFile)(filePath, 'utf-8')).trim();
    if (!content)
        throw new Error(`File is empty: ${filePath}`);
    return content;
}
// ─── Normalize spacing so tables/placeholders always render ──────────────────
// The model tends to glue the EN/ID table and the Figma placeholder directly to
// the preceding Gherkin line. Markdown tables need a blank line before them, so we
// insert a single blank line before any table start, before an image placeholder,
// and before plain content that immediately follows a table.
function tidyMarkdown(md) {
    const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isImg = (l) => l.trim().startsWith('[image-or-design-ui-from-figma]');
    // A GIVEN/WHEN/THEN clause that opens a Gherkin block (AND continuations stay attached).
    const isGwt = (l) => /^\s*(GIVEN|WHEN|THEN)\b/.test(l);
    const lines = md.split('\n');
    const out = [];
    for (const line of lines) {
        const prev = out.length ? out[out.length - 1] : '';
        const needBlankBefore = (isTable(line) && !isTable(prev)) || // table block start
            isImg(line) || // image placeholder
            isGwt(line) || // GIVEN/WHEN/THEN block start
            (!isTable(line) && !isImg(line) && line.trim() !== '' && isTable(prev)); // content after a table
        if (needBlankBefore && prev.trim() !== '')
            out.push('');
        out.push(line);
    }
    return out.join('\n');
}
// ─── Generate UAC markdown via Gemini ────────────────────────────────────────
async function generateUAC(opts) {
    const input = opts.input.trim();
    if (!input)
        throw new Error('Input kosong — berikan teks atau file yang berisi requirement.');
    const prompt = buildUACPrompt(input, opts.lang ?? 'en');
    let markdown = await (0, gemini_client_1.generateContent)(prompt, opts.model);
    // Strip an accidental wrapping ```markdown fence if the model adds one.
    markdown = markdown.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '').trim();
    return tidyMarkdown(markdown);
}
// ─── Build a filesystem-safe filename from the UAC title ─────────────────────
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'uac';
}
function extractTitle(markdown) {
    const heading = markdown.match(/^#\s+(.+)$/m);
    return heading ? heading[1].trim() : 'uac';
}
// ─── Persist the UAC markdown to <outDir>/<slug>-<timestamp>.md ──────────────
async function saveUAC(markdown, outDir, timestamp) {
    await (0, promises_1.mkdir)(outDir, { recursive: true });
    const slug = slugify(extractTitle(markdown));
    const fileName = `${slug}-${timestamp}.md`;
    const filePath = path_1.default.join(outDir, fileName);
    await (0, promises_1.writeFile)(filePath, markdown + '\n', 'utf-8');
    return { filePath, fileName, title: extractTitle(markdown) };
}
