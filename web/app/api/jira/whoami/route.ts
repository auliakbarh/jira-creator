import { NextResponse } from 'next/server';
import { getCreds, isConfigured } from '@/lib/config';
import { validateCredentials } from '@/lib/jira';

export const dynamic = 'force-dynamic';

export async function GET() {
  const creds = await getCreds();
  if (!isConfigured(creds)) {
    return NextResponse.json({ ok: false, error: 'Kredensial JIRA belum diisi.' });
  }
  try {
    const me = await validateCredentials(creds);
    return NextResponse.json({ ok: true, name: me.name, email: me.email });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
