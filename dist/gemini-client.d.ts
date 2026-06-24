export declare function generateContent(prompt: string, model?: string, extraConfig?: Record<string, unknown>): Promise<string>;
export declare function generateJSON<T>(prompt: string, model?: string, schema?: object): Promise<T>;
