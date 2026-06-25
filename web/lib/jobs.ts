import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import { DATA_DIR } from './config';
import type { TicketInput } from './jira';

const JOBS_DIR = path.join(DATA_DIR, 'jobs');

export type JobMode = 'uac' | 'epic';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface UACResult { markdown: string; ticket: TicketInput; }
export interface EpicTask { summary: string; description?: string; issuetype: string; }
export interface EpicResult { epic: { summary: string; description?: string }; tasks: EpicTask[]; }

export interface Job {
  id: string;
  mode: JobMode;
  lang: 'en' | 'id';
  projectKey?: string;
  issuetype?: string;       // requested issue type for uac mode
  requirement: string;
  status: JobStatus;
  result?: UACResult | EpicResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

async function ensureDir() { await mkdir(JOBS_DIR, { recursive: true }); }
const jobPath = (id: string) => path.join(JOBS_DIR, `${id}.json`);

function newId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createJob(input: Omit<Job, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  await ensureDir();
  const now = new Date().toISOString();
  const job: Job = { ...input, id: newId(), status: 'pending', createdAt: now, updatedAt: now };
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2), 'utf-8');
  return job;
}

export async function getJob(id: string): Promise<Job | null> {
  try {
    return JSON.parse(await readFile(jobPath(id), 'utf-8')) as Job;
  } catch {
    return null;
  }
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const job = await getJob(id);
  if (!job) return null;
  const next: Job = { ...job, ...patch, id: job.id, updatedAt: new Date().toISOString() };
  await writeFile(jobPath(id), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function listJobs(status?: JobStatus): Promise<Job[]> {
  await ensureDir();
  let files: string[] = [];
  try { files = (await readdir(JOBS_DIR)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const jobs = await Promise.all(files.map((f) => getJob(f.replace(/\.json$/, ''))));
  return jobs
    .filter((j): j is Job => j !== null && (!status || j.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
