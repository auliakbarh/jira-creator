export type IssueType = 'Bug' | 'Task' | 'Story' | 'Epic' | string;
export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | string;
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
    parentKey?: string;
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
export interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
        finishReason?: string;
    }>;
    promptFeedback?: {
        blockReason?: string;
    };
    error?: {
        code?: number;
        message?: string;
        status?: string;
    };
}
export interface UACOptions {
    input: string;
    lang?: string;
    model?: string;
}
export interface UACResult {
    filePath: string;
    fileName: string;
    title: string;
}
export interface EpicBreakdownTask {
    summary: string;
    description?: string;
    issuetype?: IssueType;
}
export interface EpicBreakdown {
    epic: {
        summary: string;
        description?: string;
    };
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
    labels: string[];
    fields: TemplateField[];
    buildSummary?: (answers: Record<string, string>) => string;
    buildDescription: (answers: Record<string, string>) => string;
}
