"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toADF = toADF;
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
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const LIST_RE = /^\s*[-*]\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/;
// Inline parsing: links and bold within a single line.
function inlineNodes(text) {
    const nodes = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last)
            nodes.push({ type: 'text', text: text.slice(last, m.index) });
        if (m[1] !== undefined) {
            nodes.push({ type: 'text', text: m[1], marks: [{ type: 'link', attrs: { href: m[2] } }] });
        }
        else {
            nodes.push({ type: 'text', text: m[3], marks: [{ type: 'strong' }] });
        }
        last = re.lastIndex;
    }
    if (last < text.length)
        nodes.push({ type: 'text', text: text.slice(last) });
    return nodes.filter(n => n.text !== '');
}
// A paragraph from one or more lines; consecutive lines are joined with hardBreaks.
function paragraphFromLines(lines) {
    const content = [];
    for (const line of lines) {
        const inline = inlineNodes(line);
        if (!inline.length)
            continue;
        if (content.length)
            content.push({ type: 'hardBreak' });
        content.push(...inline);
    }
    return { type: 'paragraph', content };
}
function splitCells(row) {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}
function toADF(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const content = [];
    let i = 0;
    const isTableStart = (idx) => TABLE_ROW_RE.test(lines[idx]) &&
        idx + 1 < lines.length &&
        TABLE_SEP_RE.test(lines[idx + 1]) &&
        lines[idx + 1].includes('-');
    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') {
            i++;
            continue;
        }
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
            const rows = [{
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
            const items = [];
            while (i < lines.length && LIST_RE.test(lines[i])) {
                const raw = lines[i].match(LIST_RE)[1];
                const cb = raw.match(/^\[([ xX])\]\s+(.*)$/); // checkbox → symbol prefix
                const itemText = cb ? `${cb[1].trim() ? '☑' : '☐'} ${cb[2]}` : raw;
                items.push({ type: 'listItem', content: [paragraphFromLines([itemText])] });
                i++;
            }
            content.push({ type: 'bulletList', content: items });
            continue;
        }
        // Paragraph (consecutive lines until a blank line or another block starts)
        const paraLines = [];
        while (i < lines.length &&
            lines[i].trim() !== '' &&
            !HEADING_RE.test(lines[i]) &&
            !LIST_RE.test(lines[i]) &&
            !isTableStart(i)) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length)
            content.push(paragraphFromLines(paraLines));
    }
    if (!content.length)
        content.push({ type: 'paragraph', content: [] });
    return { type: 'doc', version: 1, content };
}
// ─── Create single ticket ─────────────────────────────────────────────────────
async function createTicket(input) {
    const { summary, description, issuetype = process.env.JIRA_DEFAULT_ISSUE_TYPE || 'Task', priority = process.env.JIRA_DEFAULT_PRIORITY || 'Medium', labels = [], components = [], story_points, assignee_account_id, projectKey = process.env.JIRA_PROJECT_KEY, parentKey, } = input;
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
    if (parentKey)
        fields['parent'] = { key: parentKey };
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
