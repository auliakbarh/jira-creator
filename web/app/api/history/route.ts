import { NextRequest, NextResponse } from 'next/server';
import { createEntry, listEntries, HistoryMode } from '@/lib/history';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, entries: await listEntries() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    mode?: HistoryMode; lang?: 'en' | 'id'; projectKey?: string; issuetype?: string;
    requirement?: string; payload?: Record<string, unknown>; created?: boolean; result?: Record<string, unknown>;
  };
  if (body.mode !== 'uac' && body.mode !== 'epic') {
    return NextResponse.json({ ok: false, error: 'mode harus "uac" atau "epic".' }, { status: 400 });
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'payload wajib diisi.' }, { status: 400 });
  }
  const entry = await createEntry({
    mode: body.mode,
    lang: body.lang === 'id' ? 'id' : 'en',
    projectKey: body.projectKey,
    issuetype: body.issuetype,
    requirement: body.requirement ?? '',
    payload: body.payload,
    created: body.created,
    result: body.result,
  });
  return NextResponse.json({ ok: true, entry });
}
