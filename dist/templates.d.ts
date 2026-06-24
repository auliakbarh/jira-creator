import { Template, TemplateKey } from './types';
export declare const TEMPLATES: Record<TemplateKey, Template>;
export declare function applyTemplate(key: TemplateKey, answers: Record<string, string>, overrides?: {
    priority?: string;
    components?: string[];
}): {
    summary: string;
    description: string;
    issuetype: string;
    priority: string;
    labels: string[];
    components: string[];
};
