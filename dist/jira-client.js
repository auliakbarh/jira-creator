"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.createTicketsBulk = createTicketsBulk;
exports.getProjects = getProjects;
exports.getIssueTypes = getIssueTypes;
exports.validateCredentials = validateCredentials;
const BASE_URL = () => process.env.JIRA_BASE_URL.replace(/\/$/, '');
const EMAIL = () => process.env.JIRA_EMAIL;
const API_TOKEN = () => process.env.JIRA_API_TOKEN;
function authHeader() {
    return 'Basic ' + Buffer.from(`${EMAIL()}:${API_TOKEN()}`).toString('base64');
}
async function jiraFetch(path, options = {}) {
    const url = `${BASE_URL()}/rest/api/3${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: authHeader(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(options.headers || {}),
        },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const errors = body['errors']
            ? JSON.stringify(body['errors'])
            : body['errorMessages']?.join(', ') || res.statusText;
        throw new Error(`JIRA ${res.status}: ${errors}`);
    }
    return body;
}
// ─── Convert plain text → Atlassian Document Format ──────────────────────────
function toADF(text) {
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
async function createTicket(input) {
    const { summary, description, issuetype = process.env.JIRA_DEFAULT_ISSUE_TYPE || 'Task', priority = process.env.JIRA_DEFAULT_PRIORITY || 'Medium', labels = [], components = [], story_points, assignee_account_id, projectKey = process.env.JIRA_PROJECT_KEY, } = input;
    const fields = {
        project: { key: projectKey },
        summary,
        issuetype: { name: issuetype },
        priority: { name: priority },
        labels: labels.filter(Boolean),
        components: components.filter(Boolean).map(c => ({ name: c })),
    };
    if (description)
        fields['description'] = toADF(description);
    if (story_points)
        fields['story_points'] = Number(story_points);
    if (assignee_account_id)
        fields['assignee'] = { accountId: assignee_account_id };
    const result = await jiraFetch('/issue', {
        method: 'POST',
        body: JSON.stringify({ fields }),
    });
    return {
        key: result.key,
        id: result.id,
        url: `${BASE_URL()}/browse/${result.key}`,
    };
}
// ─── Bulk create ──────────────────────────────────────────────────────────────
async function createTicketsBulk(tickets) {
    const results = [];
    for (const ticket of tickets) {
        try {
            const created = await createTicket(ticket);
            results.push({ status: 'created', input: ticket.summary, ...created });
        }
        catch (err) {
            results.push({ status: 'failed', input: ticket.summary, error: err.message });
        }
    }
    return results;
}
// ─── Metadata helpers ─────────────────────────────────────────────────────────
async function getProjects() {
    const res = await jiraFetch('/project/search?maxResults=50');
    return res.values;
}
async function getIssueTypes(projectKey) {
    const res = await jiraFetch(`/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`);
    return res.projects?.[0]?.issuetypes ?? [];
}
async function validateCredentials() {
    const res = await jiraFetch('/myself');
    return { name: res.displayName, email: res.emailAddress };
}
