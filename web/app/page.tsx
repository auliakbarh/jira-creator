'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UacEditor, { UacTicket } from './components/UacEditor';
import EpicEditor, { EpicPlan } from './components/EpicEditor';

type Mode = 'uac' | 'epic';
type Step = 'input' | 'generating' | 'review' | 'done';

// Split UAC markdown into summary (first `# ` heading) + description (the rest).
function splitUAC(md: string): { summary: string; description: string } {
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (idx === -1) return { summary: (lines.find((l) => l.trim()) ?? 'UAC').trim().slice(0, 255), description: md.trim() };
  return { summary: lines[idx].replace(/^#\s+/, '').trim().slice(0, 255), description: lines.slice(idx + 1).join('\n').trim() };
}

export default function Home() {
  const [step, setStep] = useState<Step>('input');
  const [mode, setMode] = useState<Mode>('uac');
  const [requirement, setRequirement] = useState('');
  const [lang, setLang] = useState<'en' | 'id'>('id');
  const [projectKey, setProjectKey] = useState('');
  const [issuetype, setIssuetype] = useState('Story');

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [uac, setUac] = useState<UacTicket | null>(null);
  const [plan, setPlan] = useState<EpicPlan | null>(null);

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ epic?: any; created?: any; children?: any[] } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  // ── Build editable models from a generation result ──
  function loadUac(markdown: string, ticket?: any) {
    const { summary, description } = splitUAC(markdown);
    setUac({
      summary: ticket?.summary || summary,
      description: ticket?.description ?? description,
      issuetype: ticket?.issuetype || issuetype,
      priority: ticket?.priority || 'Medium',
      labels: ticket?.labels || ['uac'],
      projectKey: ticket?.projectKey || projectKey,
    });
    setStep('review');
  }
  function loadPlan(r: { epic: any; tasks: any[] }) {
    setPlan({
      epic: { summary: r.epic.summary, description: r.epic.description || '' },
      tasks: (r.tasks || []).map((t) => ({ summary: t.summary, description: t.description || '', issuetype: t.issuetype || 'Task' })),
      projectKey,
    });
    setStep('review');
  }

  // ── Submit a generation job for the Claude Code bridge to process ──
  async function generate() {
    setErr(null);
    if (!requirement.trim()) { setErr('Isi requirement dulu.'); return; }
    const r = await fetch('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, lang, projectKey, issuetype, requirement }),
    });
    const d = await r.json();
    if (!d.ok) { setErr(d.error); return; }
    setJobId(d.job.id);
    setStep('generating');
    setJobStatus('pending');
    poll.current = setInterval(async () => {
      const jr = await fetch(`/api/jobs/${d.job.id}`).then((x) => x.json());
      if (!jr.ok) return;
      setJobStatus(jr.job.status);
      if (jr.job.status === 'done') {
        clearInterval(poll.current!);
        if (mode === 'uac') loadUac(jr.job.result.markdown, jr.job.result.ticket);
        else loadPlan(jr.job.result);
      } else if (jr.job.status === 'error') {
        clearInterval(poll.current!);
        setErr(jr.job.error || 'Generation gagal.');
        setStep('input');
      }
    }, 2000);
  }

  // ── Manual paste fallback (paste Claude output directly) ──
  function applyPaste() {
    setErr(null);
    try {
      if (mode === 'uac') {
        if (!pasteText.trim()) throw new Error('Tempel markdown UAC dulu.');
        loadUac(pasteText.trim());
      } else {
        const parsed = JSON.parse(pasteText.trim());
        if (!parsed.epic || !Array.isArray(parsed.tasks)) throw new Error('JSON harus punya { epic, tasks }.');
        loadPlan(parsed);
      }
    } catch (e) {
      setErr(`Gagal memproses: ${(e as Error).message}`);
    }
  }

  // ── Create the ticket(s) in JIRA ──
  async function create() {
    setCreating(true); setErr(null);
    let body: any;
    if (mode === 'uac' && uac) {
      body = { mode: 'single', ticket: { ...uac, projectKey: uac.projectKey || undefined } };
    } else if (mode === 'epic' && plan) {
      body = {
        mode: 'epic',
        epic: { summary: plan.epic.summary, description: plan.epic.description, projectKey: plan.projectKey || undefined },
        children: plan.tasks.map((t) => ({ ...t, projectKey: plan.projectKey || undefined })),
      };
    }
    const r = await fetch('/api/jira/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    setCreating(false);
    if (!d.ok) { setErr(d.error); return; }
    setResult(d);
    setStep('done');
  }

  function reset() {
    setStep('input'); setUac(null); setPlan(null); setResult(null);
    setRequirement(''); setPasteText(''); setShowPaste(false); setJobId(null); setErr(null);
  }

  // ─────────────────────────── render ───────────────────────────
  return (
    <>
      <h1>Buat Tiket JIRA</h1>
      <p className="subtitle">UAC & breakdown dibuat lewat Claude Code (tanpa API berbayar). Tinjau & edit dulu, baru dikirim ke JIRA.</p>

      {err && <div className="alert err">{err}</div>}

      {step === 'input' && (
        <>
          <div className="card">
            <h2>1. Pilih jenis</h2>
            <div className="mode-grid">
              <div className={`mode-card ${mode === 'uac' ? 'active' : ''}`} onClick={() => setMode('uac')}>
                <h3>📝 UAC — satu tiket</h3>
                <p>Hasilkan satu tiket (Story/Task/Bug/Spike) lengkap dengan User Acceptance Criteria gaya Gherkin.</p>
              </div>
              <div className={`mode-card ${mode === 'epic' ? 'active' : ''}`} onClick={() => setMode('epic')}>
                <h3>🗂️ Epic — breakdown</h3>
                <p>Pecah sebuah Epic menjadi beberapa child issue (Story/Task) yang langsung tertaut ke Epic.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>2. Requirement</h2>
            <p className="hint">Tempel deskripsi fitur / requirement (bisa markdown). Akan dikirim ke Claude Code untuk diproses.</p>
            <textarea style={{ minHeight: 180 }} value={requirement} onChange={(e) => setRequirement(e.target.value)}
              placeholder={mode === 'uac' ? 'mis. Sebagai user saya ingin reset password lewat email…' : 'mis. Modul pembayaran: integrasi gateway, riwayat transaksi, refund…'} />
            <div className="row">
              <div>
                <label>Bahasa prosa</label>
                <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'id')}>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label>Project Key <span className="opt">(kosong = default)</span></label>
                <input type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="default dari konfigurasi" />
              </div>
              {mode === 'uac' && (
                <div>
                  <label>Issue Type</label>
                  <select value={issuetype} onChange={(e) => setIssuetype(e.target.value)}>
                    {['Story', 'Task', 'Bug', 'Spike'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="btn-row">
            <button onClick={generate}>⚡ Generate via Claude Code</button>
            <button className="secondary" onClick={() => setShowPaste((s) => !s)}>
              {showPaste ? 'Tutup paste manual' : 'Tempel hasil Claude manual'}
            </button>
          </div>

          {showPaste && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Paste manual</h2>
              <p className="hint">
                Sudah punya hasil dari Claude (chat / CLI)? Tempel di sini.{' '}
                {mode === 'uac' ? 'Untuk UAC: tempel dokumen markdown.' : 'Untuk Epic: tempel JSON { epic, tasks }.'}
              </p>
              <textarea style={{ minHeight: 200 }} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              <div className="btn-row"><button onClick={applyPaste}>Proses & tinjau</button></div>
            </div>
          )}
        </>
      )}

      {step === 'generating' && (
        <div className="card">
          <h2><span className="spinner" /> Menunggu Claude Code…</h2>
          <p className="hint">Job <code className="mono">{jobId}</code> — status: <strong>{jobStatus}</strong></p>
          <div className="alert info">
            Pastikan sesi Claude Code menjalankan skill bridge. Di terminal Claude Code, jalankan:
            <pre className="mono" style={{ marginTop: 8 }}>/jira-web</pre>
            Skill akan memproses job ini di sesi (tanpa biaya API), lalu hasilnya muncul di sini otomatis.
          </div>
          <button className="secondary" onClick={() => { if (poll.current) clearInterval(poll.current); reset(); }}>Batal</button>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className="alert ok">Hasil siap. Tinjau & edit di bawah, lalu buat tiketnya.</div>
          {mode === 'uac' && uac && <UacEditor ticket={uac} onChange={setUac} />}
          {mode === 'epic' && plan && <EpicEditor plan={plan} onChange={setPlan} />}
          <div className="btn-row">
            <button className="green" onClick={create} disabled={creating}>
              {creating ? <><span className="spinner" /> Membuat…</> : '🚀 Buat ke JIRA'}
            </button>
            <button className="secondary" onClick={reset}>Mulai ulang</button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <div className="alert ok">Selesai! Tiket berhasil dibuat.</div>
          {result.created && (
            <div className="ticket"><div className="head"><span className="summary">{result.created.key}</span>
              <a href={result.created.url} target="_blank" rel="noreferrer">Buka di JIRA →</a></div></div>
          )}
          {result.epic && (
            <div className="ticket"><div className="head"><span className="badge epic">Epic</span>
              <span className="summary">{result.epic.key}</span>
              <a href={result.epic.url} target="_blank" rel="noreferrer">Buka →</a></div></div>
          )}
          {result.children?.map((c, i) => (
            <div key={i} className="ticket child"><div className="head">
              <span className="summary">{c.status === 'created' ? c.key : `❌ ${c.input}`}</span>
              {c.status === 'created' ? <a href={c.url} target="_blank" rel="noreferrer">Buka →</a> : <span className="muted">{c.error}</span>}
            </div></div>
          ))}
          <div className="btn-row"><button onClick={reset}>Buat tiket lain</button></div>
        </>
      )}

      <hr />
      <p className="muted" style={{ fontSize: 13 }}>
        Belum mengisi kredensial JIRA? Buka <Link href="/config">Konfigurasi</Link> dulu.
      </p>
    </>
  );
}
