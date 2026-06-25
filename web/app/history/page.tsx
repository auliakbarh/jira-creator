'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UacEditor, { UacTicket } from '../components/UacEditor';
import EpicEditor, { EpicPlan } from '../components/EpicEditor';

interface Entry {
  id: string;
  mode: 'uac' | 'epic';
  lang: 'en' | 'id';
  projectKey?: string;
  issuetype?: string;
  requirement: string;
  payload: any;
  created: boolean;
  result?: any;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function resultLinks(e: Entry): { key: string; url?: string }[] {
  const r = e.result;
  if (!r) return [];
  const out: { key: string; url?: string }[] = [];
  if (r.created) out.push({ key: r.created.key, url: r.created.url });
  if (r.epic) out.push({ key: r.epic.key, url: r.epic.url });
  (r.children || []).forEach((c: any) => { if (c.status === 'created') out.push({ key: c.key, url: c.url }); });
  return out;
}

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftReq, setDraftReq] = useState('');
  const [draftPayload, setDraftPayload] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const d = await fetch('/api/history').then((r) => r.json());
    setEntries(d.ok ? d.entries : []);
  }
  useEffect(() => { load(); }, []);

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setDraftReq(e.requirement);
    setDraftPayload(structuredClone(e.payload));
    setMsg(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch(`/api/history/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirement: draftReq, payload: draftPayload }),
    });
    setSaving(false);
    setEditingId(null);
    setMsg('Perubahan tersimpan.');
    load();
  }

  function reproduce(e: Entry, useDraft = false) {
    const payload = useDraft && editingId === e.id ? draftPayload : e.payload;
    const requirement = useDraft && editingId === e.id ? draftReq : e.requirement;
    sessionStorage.setItem('jira-repro', JSON.stringify({
      mode: e.mode, lang: e.lang, projectKey: e.projectKey || '', issuetype: e.issuetype, requirement, payload,
    }));
    router.push('/');
  }

  async function remove(id: string) {
    if (!confirm('Hapus item riwayat ini?')) return;
    await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (editingId === id) setEditingId(null);
    load();
  }

  if (entries === null) return <p className="muted">Memuat…</p>;

  return (
    <>
      <h1>Riwayat</h1>
      <p className="subtitle">Riwayat pembuatan UAC & tiket JIRA. Edit untuk reproduce, atau hapus.</p>
      {msg && <div className="alert ok">{msg}</div>}

      {entries.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Belum ada riwayat. Buat UAC atau tiket dulu di <a href="/">Buat Tiket</a>.</p></div>}

      {entries.map((e) => {
        const editing = editingId === e.id;
        const links = resultLinks(e);
        return (
          <div className="card" key={e.id}>
            <div className="page-head" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${e.mode === 'epic' ? 'epic' : 'story'}`}>{e.mode === 'epic' ? 'Epic' : 'UAC'}</span>
                <strong>{e.title}</strong>
                {e.created
                  ? <span className="badge task">✓ dibuat</span>
                  : <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>draft</span>}
              </div>
              <span className="muted mono" style={{ fontSize: 12 }}>{new Date(e.createdAt).toLocaleString('id-ID')}</span>
            </div>

            {links.length > 0 && (
              <p className="hint" style={{ margin: '8px 0 0' }}>
                Tiket: {links.map((l, i) => (
                  <span key={l.key}>{i > 0 && ', '}{l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.key}</a> : l.key}</span>
                ))}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="small" onClick={() => reproduce(e)}>♻️ Reproduce</button>
              <button className="secondary small" onClick={() => (editing ? setEditingId(null) : startEdit(e))}>
                {editing ? 'Tutup edit' : '✏️ Edit'}
              </button>
              <span style={{ flex: 1 }} />
              <button className="danger" onClick={() => remove(e.id)}>🗑️ Hapus</button>
            </div>

            {editing && draftPayload && (
              <div style={{ marginTop: 16 }}>
                <hr />
                <label>Requirement asli <span className="opt">(untuk generate ulang)</span></label>
                <textarea value={draftReq} onChange={(ev) => setDraftReq(ev.target.value)} style={{ minHeight: 90 }} />

                <label>Isi tiket</label>
                {e.mode === 'uac'
                  ? <UacEditor ticket={draftPayload as UacTicket} onChange={setDraftPayload} />
                  : <EpicEditor plan={draftPayload as EpicPlan} onChange={setDraftPayload} />}

                <div className="btn-row">
                  <button className="green" onClick={() => saveEdit(e.id)} disabled={saving}>
                    {saving ? 'Menyimpan…' : '💾 Simpan perubahan'}
                  </button>
                  <button className="secondary" onClick={() => reproduce(e, true)}>♻️ Reproduce versi ini (tanpa simpan)</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
