import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob, Job } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ ok: false, error: 'Job tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

// The Claude Code bridge PATCHes status/result here as it processes the job.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = (await req.json()) as Partial<Job>;
  const job = await updateJob(params.id, patch);
  if (!job) return NextResponse.json({ ok: false, error: 'Job tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
