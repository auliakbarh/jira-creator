import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import path from 'path';
import { DATA_DIR } from './config';

const HISTORY_DIR = path.join(DATA_DIR, 'history');

export type HistoryMode = 'uac' | 'epic';
export type HistoryStage = 'input' | 'review';

// `payload` depends on `stage`:
//  - stage 'review' (a generated/edited ticket, ready to create):
//      uac  → { summary, description, issuetype, priority, labels[], projectKey }
//      epic → { epic:{summary,description}, tasks:[...], projectKey }
//  - stage 'input' (work-in-progress before generating): a snapshot of the input
//      form → { requirement, inputTab, pasteTab, pasteText, builderPlan }
export interface HistoryEntry {
  id: string;
  mode: HistoryMode;
  stage: HistoryStage;
  lang: 'en' | 'id';
  projectKey?: string;
  issuetype?: string;
  requirement: string;          // original input — lets the user re-generate
  payload: Record<string, unknown>;
  created: boolean;             // pushed to JIRA?
  result?: Record<string, unknown>;  // JIRA keys/urls when created
  title: string;                // short label for the list
  createdAt: string;
  updatedAt: string;
}

async function ensureDir() { await mkdir(HISTORY_DIR, { recursive: true }); }
const entryPath = (id: string) => path.join(HISTORY_DIR, `${id}.json`);

function newId(): string {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Derive a short human label from the payload.
function deriveTitle(mode: HistoryMode, payload: Record<string, unknown>, stage: HistoryStage): string {
  if (stage === 'input') {
    const p = payload as any;
    if (p?.method === 'paste-form') return String(p?.builderPlan?.epic?.summary || 'Draft form (belum dibuat)');
    const txt = String((p?.method?.startsWith?.('paste') ? p?.pasteText : p?.requirement) || p?.requirement || p?.pasteText || '').trim();
    return txt ? txt.split('\n')[0].slice(0, 80) : 'Draft (belum digenerate)';
  }
  if (mode === 'uac') return String((payload as any)?.summary || 'UAC tanpa judul');
  const epic = (payload as any)?.epic;
  return String(epic?.summary || 'Epic tanpa judul');
}

export async function createEntry(
  input: Pick<HistoryEntry, 'mode' | 'lang' | 'requirement' | 'payload'> &
    Partial<Pick<HistoryEntry, 'stage' | 'projectKey' | 'issuetype' | 'created' | 'result'>>
): Promise<HistoryEntry> {
  await ensureDir();
  const now = new Date().toISOString();
  const stage: HistoryStage = input.stage ?? 'review';
  const entry: HistoryEntry = {
    id: newId(),
    mode: input.mode,
    stage,
    lang: input.lang,
    projectKey: input.projectKey,
    issuetype: input.issuetype,
    requirement: input.requirement,
    payload: input.payload,
    created: input.created ?? false,
    result: input.result,
    title: deriveTitle(input.mode, input.payload, stage),
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(entryPath(entry.id), JSON.stringify(entry, null, 2), 'utf-8');
  return entry;
}

export async function getEntry(id: string): Promise<HistoryEntry | null> {
  try { return JSON.parse(await readFile(entryPath(id), 'utf-8')) as HistoryEntry; }
  catch { return null; }
}

export async function updateEntry(id: string, patch: Partial<HistoryEntry>): Promise<HistoryEntry | null> {
  const entry = await getEntry(id);
  if (!entry) return null;
  const next: HistoryEntry = { ...entry, ...patch, id: entry.id, stage: patch.stage ?? entry.stage ?? 'review', updatedAt: new Date().toISOString() };
  if (patch.payload) next.title = deriveTitle(next.mode, next.payload, next.stage);
  await writeFile(entryPath(id), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function deleteEntry(id: string): Promise<boolean> {
  try { await unlink(entryPath(id)); return true; } catch { return false; }
}

export async function listEntries(): Promise<HistoryEntry[]> {
  await ensureDir();
  let files: string[] = [];
  try { files = (await readdir(HISTORY_DIR)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const entries = await Promise.all(files.map((f) => getEntry(f.replace(/\.json$/, ''))));
  return entries
    .filter((e): e is HistoryEntry => e !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
