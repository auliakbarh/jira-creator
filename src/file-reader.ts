import { readFile } from 'fs/promises';
import { parse as parseCSV } from 'csv-parse/sync';
import path from 'path';
import { TicketInput } from './types';

export async function readInputFile(filePath: string): Promise<TicketInput[]> {
  const ext = path.extname(filePath).toLowerCase();
  const raw = await readFile(filePath, 'utf-8');

  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    const items  = Array.isArray(parsed) ? parsed : parsed.tickets ?? [parsed];
    return items as TicketInput[];
  }

  if (ext === '.csv') {
    const rows = parseCSV(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return rows.map(row => ({
      ...row,
      labels:     row.labels     ? row.labels.split('|').map(s => s.trim())     : [],
      components: row.components ? row.components.split('|').map(s => s.trim()) : [],
      story_points: row.story_points ? Number(row.story_points) : undefined,
    })) as TicketInput[];
  }

  if (ext === '.txt' || ext === '') {
    return [{ summary: raw.trim().split('\n')[0], description: raw.trim() }];
  }

  throw new Error(`Unsupported file type: ${ext}. Use .json, .csv, or .txt`);
}

export function validateItems(items: TicketInput[]): string[] {
  return items.flatMap((item, i) => {
    if (!item.summary && !item.description) {
      return [`Row ${i + 1}: must have at least "summary" or "description"`];
    }
    return [];
  });
}

// If only description given, derive summary from first sentence
export function normalizeItems(items: TicketInput[]): TicketInput[] {
  return items.map(item => {
    if (!item.summary && item.description) {
      const firstLine = (item.description as string).split(/[.\n]/)[0].trim();
      item.summary = firstLine.slice(0, 200);
    }
    return item;
  });
}
