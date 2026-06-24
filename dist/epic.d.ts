import { EpicBreakdown } from './types';
export declare const DEFAULT_EPIC_OUTPUT_DIR = "output-uac";
export declare function buildBreakdownPrompt(input: string, lang: string): string;
export declare function generateBreakdown(input: string, opts?: {
    lang?: string;
    model?: string;
}): Promise<EpicBreakdown>;
export declare function saveBreakdownPlan(breakdown: EpicBreakdown, outDir: string, timestamp: string): Promise<string>;
