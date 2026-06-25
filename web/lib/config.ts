import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { JiraCreds } from './jira';

// Where runtime data lives. Override with JIRA_CREATOR_DATA_DIR (e.g. a writable
// /tmp path on serverless). Defaults to web/.data (gitignored) for local use.
export const DATA_DIR = process.env.JIRA_CREATOR_DATA_DIR || path.join(process.cwd(), '.data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export interface StoredConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  defaultIssueType: string;
  defaultPriority: string;
}

const EMPTY: StoredConfig = {
  baseUrl: '', email: '', apiToken: '', projectKey: '', defaultIssueType: 'Task', defaultPriority: 'Medium',
};

// Env vars seed the config when no file exists yet (handy on a deployed host).
function fromEnv(): Partial<StoredConfig> {
  return {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    defaultIssueType: process.env.JIRA_DEFAULT_ISSUE_TYPE || '',
    defaultPriority: process.env.JIRA_DEFAULT_PRIORITY || '',
  };
}

export async function loadConfig(): Promise<StoredConfig> {
  let stored: Partial<StoredConfig> = {};
  try {
    stored = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  } catch {
    /* no file yet — fall back to env */
  }
  const env = fromEnv();
  // file overrides env; env overrides defaults
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.entries(env).filter(([, v]) => v)),
    ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== undefined && v !== '')),
  } as StoredConfig;
}

export async function saveConfig(cfg: StoredConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

export async function getCreds(): Promise<JiraCreds> {
  const c = await loadConfig();
  return {
    baseUrl: c.baseUrl,
    email: c.email,
    apiToken: c.apiToken,
    projectKey: c.projectKey || undefined,
    defaultIssueType: c.defaultIssueType || undefined,
    defaultPriority: c.defaultPriority || undefined,
  };
}

export function isConfigured(c: JiraCreds): boolean {
  return Boolean(c.baseUrl && c.email && c.apiToken);
}

// Never leak the token to the client — return a masked view.
export function maskConfig(c: StoredConfig): StoredConfig & { hasToken: boolean } {
  return { ...c, apiToken: c.apiToken ? '••••••••' : '', hasToken: Boolean(c.apiToken) };
}
