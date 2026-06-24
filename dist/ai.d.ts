import { Provider } from './types';
export declare function resolveProvider(flag?: string): Provider;
export declare function providerEnvVar(provider: Provider): string;
export declare function modelLabel(provider: Provider, model?: string): string;
export declare function generateText(prompt: string, opts: {
    provider: Provider;
    model?: string;
}): Promise<string>;
export declare function generateJSON<T>(prompt: string, opts: {
    provider: Provider;
    model?: string;
    schema?: object;
}): Promise<T>;
