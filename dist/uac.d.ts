import { UACOptions, UACResult } from './types';
export declare const DEFAULT_OUTPUT_DIR = "output-uac";
export declare function buildUACPrompt(input: string, lang: string): string;
export declare function readUACInput(filePath: string): Promise<string>;
export declare function tidyMarkdown(md: string): string;
export declare function generateUAC(opts: UACOptions): Promise<string>;
export declare function slugify(text: string): string;
export declare function saveUAC(markdown: string, outDir: string, timestamp: string): Promise<UACResult>;
