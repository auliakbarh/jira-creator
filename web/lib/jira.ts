// Self-contained JIRA REST v3 client for the web UI. Mirrors src/jira-client.ts
// but takes credentials explicitly (the web UI stores them in a config file,
// not process.env) so the web app stays deployable on its own.

export interface JiraCreds {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
  defaultIssueType?: string;
  defaultPriority?: string;
}

export interface TicketInput {
  summary: string;
  description?: string;
  issuetype?: string;
  priority?: string;
  labels?: string[];
  components?: string[];
  story_points?: number;
  projectKey?: string;
  parentKey?: string;
  [key: string]: unknown;
}

export interface CreatedTicket { key: string; id: string; url: string; }
export interface BulkResult { status: 'created' | 'failed'; input: string; key?: string; url?: string; error?: string; }
export interface JiraProject { id: string; key: string; name: string; }
export interface JiraIssueType { id: string; name: string; description: string; subtask?: boolean; }

function authHeader(c: JiraCreds): string {
  return 'Basic ' + Buffer.from(`${c.email}:${c.apiToken}`).toString('base64');
}

async function jiraFetch<T>(c: JiraCreds, path: string, options: RequestInit = {}): Promise<T> {
  const base = c.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(c),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = body['errors']
      ? JSON.stringify(body['errors'])
      : (body['errorMessages'] as string[] | undefined)?.join(', ') || res.statusText;
    throw new Error(`JIRA ${res.status}: ${errors}`);
  }
  return body as T;
}

// ─── markdown → Atlassian Document Format (ADF) ──────────────────────────────
interface ADFNode { type: string; [key: string]: unknown; }

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const LIST_RE = /^\s*[-*]\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

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
  return nodes.filter((n) => n.text !== '');
}

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
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
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

    const h = line.match(HEADING_RE);
    if (h) {
      content.push({ type: 'heading', attrs: { level: Math.min(h[1].length, 6) }, content: inlineNodes(h[2].trim()) });
      i++;
      continue;
    }

    if (isTableStart(i)) {
      const header = splitCells(lines[i]);
      i += 2;
      const rows: ADFNode[] = [{
        type: 'tableRow',
        content: header.map((c) => ({ type: 'tableHeader', content: [paragraphFromLines([c])] })),
      }];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        const cells = splitCells(lines[i]);
        rows.push({ type: 'tableRow', content: cells.map((c) => ({ type: 'tableCell', content: [paragraphFromLines([c])] })) });
        i++;
      }
      content.push({ type: 'table', attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: rows });
      continue;
    }

    if (LIST_RE.test(line)) {
      const items: ADFNode[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        const raw = lines[i].match(LIST_RE)![1];
        const cb = raw.match(/^\[([ xX])\]\s+(.*)$/);
        const itemText = cb ? `${cb[1].trim() ? '☑' : '☐'} ${cb[2]}` : raw;
        items.push({ type: 'listItem', content: [paragraphFromLines([itemText])] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

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

// ─── API calls ───────────────────────────────────────────────────────────────
export async function createTicket(c: JiraCreds, input: TicketInput): Promise<CreatedTicket> {
  const {
    summary,
    description,
    issuetype = c.defaultIssueType || 'Task',
    priority = c.defaultPriority || 'Medium',
    components = [],
    story_points,
    projectKey = c.projectKey,
    parentKey,
  } = input;

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issuetype },
    components: (components as string[]).filter(Boolean).map((x) => ({ name: x })),
  };
  // Priority/components are not enabled on every project; only set priority when given.
  if (priority) fields['priority'] = { name: priority };
  if (description) fields['description'] = toADF(description);
  if (story_points) fields['story_points'] = Number(story_points);
  if (parentKey) fields['parent'] = { key: parentKey };

  const result = await jiraFetch<{ key: string; id: string }>(c, '/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  return { key: result.key, id: result.id, url: `${c.baseUrl.replace(/\/$/, '')}/browse/${result.key}` };
}

export async function createTicketsBulk(c: JiraCreds, tickets: TicketInput[]): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const ticket of tickets) {
    try {
      const created = await createTicket(c, ticket);
      results.push({ status: 'created', input: ticket.summary, ...created });
    } catch (err) {
      results.push({ status: 'failed', input: ticket.summary, error: (err as Error).message });
    }
  }
  return results;
}

export async function getProjects(c: JiraCreds): Promise<JiraProject[]> {
  const res = await jiraFetch<{ values: JiraProject[] }>(c, '/project/search?maxResults=50');
  return res.values;
}

export async function getIssueTypes(c: JiraCreds, projectKey: string): Promise<JiraIssueType[]> {
  const res = await jiraFetch<{ projects: Array<{ issuetypes: JiraIssueType[] }> }>(
    c,
    `/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`
  );
  return res.projects?.[0]?.issuetypes ?? [];
}

export async function validateCredentials(c: JiraCreds): Promise<{ name: string; email: string }> {
  const res = await jiraFetch<{ displayName: string; emailAddress: string }>(c, '/myself');
  return { name: res.displayName, email: res.emailAddress };
}
