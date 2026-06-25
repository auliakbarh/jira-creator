import { NextResponse } from 'next/server';
import { getCreds, isConfigured } from '@/lib/config';
import { getProjects } from '@/lib/jira';

export const dynamic = 'force-dynamic';

export async function GET() {
  const creds = await getCreds();
  if (!isConfigured(creds)) return NextResponse.json({ ok: false, error: 'Kredensial JIRA belum diisi.' });
  try {
    return NextResponse.json({ ok: true, projects: await getProjects(creds) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
