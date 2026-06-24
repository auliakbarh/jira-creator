import { TicketInput } from './types';
export declare function readInputFile(filePath: string): Promise<TicketInput[]>;
export declare function validateItems(items: TicketInput[]): string[];
export declare function normalizeItems(items: TicketInput[]): TicketInput[];
