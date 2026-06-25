import { NextRequest, NextResponse } from 'next/server';
import { getCreds, isConfigured } from '@/lib/config';
import { getIssueTypes } from '@/lib/jira';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const creds = await getCreds();
  if (!isConfigured(creds)) return NextResponse.json({ ok: false, error: 'Kredensial JIRA belum diisi.' });
  const projectKey = req.nextUrl.searchParams.get('projectKey') || creds.projectKey;
  if (!projectKey) return NextResponse.json({ ok: false, error: 'projectKey wajib diisi.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, types: await getIssueTypes(creds, projectKey) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
