import { TicketInput, CreatedTicket, BulkResult, JiraProject, JiraIssueType } from './types';

const BASE_URL  = () => process.env.JIRA_BASE_URL!.replace(/\/$/, '');
const EMAIL     = () => process.env.JIRA_EMAIL!;
const API_TOKEN = () => process.env.JIRA_API_TOKEN!;

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${EMAIL()}:${API_TOKEN()}`).toString('base64');
}

async function jiraFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL()}/rest/api/3${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const errors = body['errors']
      ? JSON.stringify(body['errors'])
      : (body['errorMessages'] as string[] | undefined)?.join(', ') || res.statusText;
    throw new Error(`JIRA ${res.status}: ${errors}`);
  }

  return body as T;
}

// ─── Convert markdown → Atlassian Document Format (ADF) ──────────────────────
// JIRA API v3 requires `description` as ADF. This supports the markdown that the
// templates and the `uac` command emit: headings (`#`..`######`), bullet lists
// (`-`/`*`, incl. `- [ ]`/`- [x]` checkboxes), GFM pipe tables, inline links
// (`[text](url)`) and bold (`**text**`). Single newlines inside a block become
// hardBreaks (so stacked Gherkin clauses stay on separate lines); blank lines
// separate blocks. Anything unrecognised falls back to a paragraph.
interface ADFNode { type: string; [key: string]: unknown; }

const HEADING_RE   = /^(#{1,6})\s+(.*)$/;
const LIST_RE      = /^\s*[-*]\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

// Inline parsing: links and bold within a single line.
function inlineNodes(text: string): ADFNode[] {
  const nodes: ADFNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      nodes.push({ type: 'text', text: m[1], marks: [{ type: 'link', attrs: { href: m[2] } }] });
    } else {
      nodes.push({ type: 'text', text: m[3], marks: [{ type: 'strong' }] });
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes.filter(n => n.text !== '');
}

// A paragraph from one or more lines; consecutive lines are joined with hardBreaks.
function paragraphFromLines(lines: string[]): ADFNode {
  const content: ADFNode[] = [];
  for (const line of lines) {
    const inline = inlineNodes(line);
    if (!inline.length) continue;
    if (content.length) content.push({ type: 'hardBreak' });
    content.push(...inline);
  }
  return { type: 'paragraph', content };
}

function splitCells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

export function toADF(text: string): object {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const content: ADFNode[] = [];
  let i = 0;

  const isTableStart = (idx: number) =>
    TABLE_ROW_RE.test(lines[idx]) &&
    idx + 1 < lines.length &&
    TABLE_SEP_RE.test(lines[idx + 1]) &&
    lines[idx + 1].includes('-');

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // Heading
    const h = line.match(HEADING_RE);
    if (h) {
      content.push({ type: 'heading', attrs: { level: Math.min(h[1].length, 6) }, content: inlineNodes(h[2].trim()) });
      i++;
      continue;
    }

    // GFM pipe table (header row immediately followed by a |---|---| separator)
    if (isTableStart(i)) {
      const header = splitCells(lines[i]);
      i += 2; // skip header + separator
      const rows: ADFNode[] = [{
        type: 'tableRow',
        content: header.map(c => ({ type: 'tableHeader', content: [paragraphFromLines([c])] })),
      }];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        const cells = splitCells(lines[i]);
        rows.push({ type: 'tableRow', content: cells.map(c => ({ type: 'tableCell', content: [paragraphFromLines([c])] })) });
        i++;
      }
      content.push({ type: 'table', attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: rows });
      continue;
    }

    // Bullet list (collect contiguous list items)
    if (LIST_RE.test(line)) {
      const items: ADFNode[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        const raw = lines[i].match(LIST_RE)![1];
        const cb  = raw.match(/^\[([ xX])\]\s+(.*)$/); // checkbox → symbol prefix
        const itemText = cb ? `${cb[1].trim() ? '☑' : '☐'} ${cb[2]}` : raw;
        items.push({ type: 'listItem', content: [paragraphFromLines([itemText])] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    // Paragraph (consecutive lines until a blank line or another block starts)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !HEADING_RE.test(lines[i]) &&
      !LIST_RE.test(lines[i]) &&
      !isTableStart(i)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) content.push(paragraphFromLines(paraLines));
  }

  if (!content.length) content.push({ type: 'paragraph', content: [] });
  return { type: 'doc', version: 1, content };
}

// ─── Create single ticket ─────────────────────────────────────────────────────
export async function createTicket(input: TicketInput): Promise<CreatedTicket> {
  const {
    summary,
    description,
    issuetype   = process.env.JIRA_DEFAULT_ISSUE_TYPE || 'Task',
    priority    = process.env.JIRA_DEFAULT_PRIORITY   || 'Medium',
    labels      = [],
    components  = [],
    story_points,
    assignee_account_id,
    projectKey  = process.env.JIRA_PROJECT_KEY,
    parentKey,
  } = input;

  const fields: Record<string, unknown> = {
    project:     { key: projectKey },
    summary,
    issuetype:   { name: issuetype },
    priority:    { name: priority },
    labels:      (labels as string[]).filter(Boolean),
    components:  (components as string[]).filter(Boolean).map(c => ({ name: c })),
  };

  if (description)          fields['description']   = toADF(description);
  if (story_points)         fields['story_points']  = Number(story_points);
  if (assignee_account_id)  fields['assignee']      = { accountId: assignee_account_id };
  if (parentKey)            fields['parent']        = { key: parentKey };

  const result = await jiraFetch<{ key: string; id: string }>('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  return {
    key: result.key,
    id:  result.id,
    url: `${BASE_URL()}/browse/${result.key}`,
  };
}

// ─── Bulk create ──────────────────────────────────────────────────────────────
export async function createTicketsBulk(tickets: TicketInput[]): Promise<BulkResult[]> {
  const results: BulkResult[] = [];

  for (const ticket of tickets) {
    try {
      const created = await createTicket(ticket);
      results.push({ status: 'created', input: ticket.summary, ...created });
    } catch (err) {
      results.push({ status: 'failed', input: ticket.summary, error: (err as Error).message });
    }
  }

  return results;
}

// ─── Metadata helpers ─────────────────────────────────────────────────────────
export async function getProjects(): Promise<JiraProject[]> {
  const res = await jiraFetch<{ values: JiraProject[] }>('/project/search?maxResults=50');
  return res.values;
}

export async function getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
  const res = await jiraFetch<{ projects: Array<{ issuetypes: JiraIssueType[] }> }>(
    `/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`
  );
  return res.projects?.[0]?.issuetypes ?? [];
}

export async function validateCredentials(): Promise<{ name: string; email: string }> {
  const res = await jiraFetch<{ displayName: string; emailAddress: string }>('/myself');
  return { name: res.displayName, email: res.emailAddress };
}
