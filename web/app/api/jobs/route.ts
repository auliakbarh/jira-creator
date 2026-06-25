import { NextRequest, NextResponse } from 'next/server';
import { createJob, listJobs, JobMode, JobStatus } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

// List jobs (used by the Claude Code bridge to find pending work, and by the UI).
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') as JobStatus | null;
  const jobs = await listJobs(status ?? undefined);
  return NextResponse.json({ ok: true, jobs });
}

// Create a generation job. The Claude Code session (jira-web skill) processes it.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    mode?: JobMode; lang?: 'en' | 'id'; projectKey?: string; issuetype?: string; requirement?: string;
  };
  if (!body.requirement?.trim()) {
    return NextResponse.json({ ok: false, error: 'Requirement kosong.' }, { status: 400 });
  }
  if (body.mode !== 'uac' && body.mode !== 'epic') {
    return NextResponse.json({ ok: false, error: 'mode harus "uac" atau "epic".' }, { status: 400 });
  }
  const job = await createJob({
    mode: body.mode,
    lang: body.lang === 'id' ? 'id' : 'en',
    projectKey: body.projectKey?.trim() || undefined,
    issuetype: body.issuetype?.trim() || undefined,
    requirement: body.requirement.trim(),
  });
  return NextResponse.json({ ok: true, job });
}
