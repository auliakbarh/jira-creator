import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

// Re-queue a job so the Claude Code bridge picks it up again on its next pass.
// Clears any stuck `processing`/`error` state and previous result, and bumps
// `updatedAt` (via updateJob) so the bridge sees fresh pending work.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ ok: false, error: 'Job tidak ditemukan.' }, { status: 404 });

  const next = await updateJob(params.id, { status: 'pending', result: undefined, error: undefined });
  return NextResponse.json({ ok: true, job: next });
}
