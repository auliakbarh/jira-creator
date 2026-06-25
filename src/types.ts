export type IssueType = 'Bug' | 'Task' | 'Story' | 'Epic' | string;
export type Priority  = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | string;

export interface TicketInput {
  summary: string;
  description?: string;
  issuetype?: IssueType;
  priority?: Priority;
  labels?: string[];
  components?: string[];
  story_points?: number;
  assignee_account_id?: string;
  projectKey?: string;
  parentKey?: string;   // link this issue to a parent epic/issue (fields.parent)
  // extra fields from CSV/JSON passthrough
  [key: string]: unknown;
}

export interface CreatedTicket {
  key: string;
  id: string;
  url: string;
}

export interface BulkResult {
  status: 'created' | 'failed';
  input: string;
  key?: string;
  url?: string;
  error?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
}

// ─── AI provider selection ────────────────────────────────────────────────────
export type Provider = 'gemini' | 'claude';

// ─── Google Gemini ────────────────────────────────────────────────────────────
export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

// ─── UAC generation ─────────────────────────────────────────────────────────
export interface UACOptions {
  input: string;        // raw requirement text (from --text or a file)
  lang?: string;        // 'id' (default) | 'en'
  model?: string;       // override the provider's default model
  provider?: Provider;  // 'gemini' (default) | 'claude'
}

export interface UACResult {
  filePath: string;
  fileName: string;
  title: string;
}

// ─── Epic breakdown (epic → child tasks) ─────────────────────────────────────
export interface EpicBreakdownTask {
  summary: string;
  description?: string;
  issuetype?: IssueType;   // 'Story' | 'Task'
}

export interface EpicBreakdown {
  epic: { summary: string; description?: string };
  tasks: EpicBreakdownTask[];
}

export type TemplateKey = 'bug' | 'story' | 'task' | 'epic';

export interface TemplateField {
  key: string;
  prompt: string;
  placeholder?: string;
  textarea?: boolean;
}

export interface Template {
  name: string;
  issuetype: IssueType;
  defaultPriority: Priority;
  fields: TemplateField[];
  buildSummary?: (answers: Record<string, string>) => string;
  buildDescription: (answers: Record<string, string>) => string;
}
