import { NextRequest, NextResponse } from 'next/server';
import { getCreds, isConfigured } from '@/lib/config';
import { createTicket, createTicketsBulk, TicketInput } from '@/lib/jira';

export const dynamic = 'force-dynamic';

interface CreateBody {
  mode: 'single' | 'epic';
  ticket?: TicketInput;
  epic?: TicketInput;
  children?: TicketInput[];
}

export async function POST(req: NextRequest) {
  const creds = await getCreds();
  if (!isConfigured(creds)) {
    return NextResponse.json({ ok: false, error: 'Kredensial JIRA belum diisi.' }, { status: 400 });
  }

  const body = (await req.json()) as CreateBody;

  try {
    if (body.mode === 'single') {
      if (!body.ticket?.summary) return NextResponse.json({ ok: false, error: 'Ticket summary kosong.' }, { status: 400 });
      const created = await createTicket(creds, body.ticket);
      return NextResponse.json({ ok: true, mode: 'single', created });
    }

    if (body.mode === 'epic') {
      if (!body.epic?.summary) return NextResponse.json({ ok: false, error: 'Epic summary kosong.' }, { status: 400 });
      const epic = await createTicket(creds, { ...body.epic, issuetype: 'Epic' });
      const children = (body.children ?? []).map((c) => ({ ...c, parentKey: epic.key }));
      const childResults = children.length ? await createTicketsBulk(creds, children) : [];
      return NextResponse.json({ ok: true, mode: 'epic', epic, children: childResults });
    }

    return NextResponse.json({ ok: false, error: 'mode tidak dikenal.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
