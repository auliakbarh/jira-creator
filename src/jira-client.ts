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

// ─── Convert plain text → Atlassian Document Format ──────────────────────────
function toADF(text: string): object {
  const paragraphs = text.split('\n\n').filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map(para => {
      // Handle markdown-style bold (**text**)
      const parts = para.split(/(\*\*[^*]+\*\*)/g);
      return {
        type: 'paragraph',
        content: parts.map(part => {
          const boldMatch = part.match(/^\*\*(.+)\*\*$/);
          if (boldMatch) {
            return { type: 'text', text: boldMatch[1], marks: [{ type: 'strong' }] };
          }
          return { type: 'text', text: part };
        }).filter(p => p.text),
      };
    }),
  };
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
