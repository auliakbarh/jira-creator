import { NextRequest, NextResponse } from 'next/server';
import { getEntry, updateEntry, deleteEntry, HistoryEntry } from '@/lib/history';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const entry = await getEntry(params.id);
  if (!entry) return NextResponse.json({ ok: false, error: 'Riwayat tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ok: true, entry });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = (await req.json()) as Partial<HistoryEntry>;
  const entry = await updateEntry(params.id, patch);
  if (!entry) return NextResponse.json({ ok: false, error: 'Riwayat tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await deleteEntry(params.id);
  if (!ok) return NextResponse.json({ ok: false, error: 'Riwayat tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
