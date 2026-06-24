import { TicketInput, CreatedTicket, BulkResult, JiraProject, JiraIssueType } from './types';
export declare function createTicket(input: TicketInput): Promise<CreatedTicket>;
export declare function createTicketsBulk(tickets: TicketInput[]): Promise<BulkResult[]>;
export declare function getProjects(): Promise<JiraProject[]>;
export declare function getIssueTypes(projectKey: string): Promise<JiraIssueType[]>;
export declare function validateCredentials(): Promise<{
    name: string;
    email: string;
}>;
