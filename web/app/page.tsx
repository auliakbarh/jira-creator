'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UacEditor, { UacTicket } from './components/UacEditor';
import EpicEditor, { EpicPlan } from './components/EpicEditor';
import EnvModal, { EnvCfg, isConfigured } from './components/EnvModal';

type Mode = 'uac' | 'epic';
type Step = 'input' | 'generating' | 'review' | 'done';
type InputTab = 'generate' | 'paste';
type PasteTab = 'json' | 'form';

// A fresh epic plan for the manual form builder.
function emptyPlan(): EpicPlan {
  return { epic: { summary: '', description: '' }, tasks: [{ summary: '', description: '', issuetype: 'Story' }], projectKey: '' };
}

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
  const [lang, setLang] = useState<'en' | 'id'>('en');
  const [projectKey, setProjectKey] = useState('');
  const [issuetype, setIssuetype] = useState('Story');

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [inputTab, setInputTab] = useState<InputTab>('generate');
  const [pasteTab, setPasteTab] = useState<PasteTab>('json');
  const [bridgeMsg, setBridgeMsg] = useState<string>('');
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [builderPlan, setBuilderPlan] = useState<EpicPlan>(emptyPlan());
  const [err, setErr] = useState<string | null>(null);

  // Environment / credentials gate.
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showEnv, setShowEnv] = useState(false);
  const [envProjectKey, setEnvProjectKey] = useState('');

  const [uac, setUac] = useState<UacTicket | null>(null);
  const [plan, setPlan] = useState<EpicPlan | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [inputDraftId, setInputDraftId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [result, setResult] = useState<{ epic?: any; created?: any; children?: any[] } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  // Reproduce from history: the Riwayat page stashes an entry then routes here.
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('jira-repro') : null;
    if (!raw) return;
    sessionStorage.removeItem('jira-repro');
    try {
      const e = JSON.parse(raw);
      setMode(e.mode);
      setLang(e.lang === 'id' ? 'id' : 'en');
      setProjectKey(e.projectKey || '');
      if (e.issuetype) setIssuetype(e.issuetype);

      if (e.stage === 'input') {
        // Resume an input-stage draft: restore the form, stay on the input step.
        const p = e.payload || {};
        setRequirement(p.requirement || '');
        setInputTab(p.inputTab || 'generate');
        setPasteTab(p.pasteTab || 'json');
        setPasteText(p.pasteText || '');
        setBuilderPlan(p.builderPlan || emptyPlan());
        setInputDraftId(e.id || null);
        setHistoryId(null);
        setStep('input');
      } else {
        // Resume a review-stage draft: load the ticket, go straight to review.
        setRequirement(e.requirement || '');
        setHistoryId(e.id || null); // creating promotes this same entry
        setInputDraftId(null);
        if (e.mode === 'uac') { setUac(e.payload); setStep('review'); }
        else { setPlan(e.payload); setStep('review'); }
      }
    } catch { /* ignore malformed repro */ }
  }, []);

  // On load, check env. If creds missing → force the env modal open.
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d: EnvCfg) => {
        const ok = isConfigured(d);
        setConfigured(ok);
        setEnvProjectKey(d?.projectKey || '');
        if (!ok) setShowEnv(true);
      })
      .catch(() => { setConfigured(false); setShowEnv(true); });
  }, []);

  // ── Build editable models from a generation result ──
  function loadUac(markdown: string, ticket?: any): UacTicket {
    const { summary, description } = splitUAC(markdown);
    const u: UacTicket = {
      summary: ticket?.summary || summary,
      description: ticket?.description ?? description,
      issuetype: ticket?.issuetype || issuetype,
      priority: ticket?.priority || 'Medium',
      projectKey: ticket?.projectKey || projectKey,
    };
    setUac(u);
    setStep('review');
    return u;
  }
  function loadPlan(r: { epic: any; tasks: any[] }): EpicPlan {
    const p: EpicPlan = {
      epic: { summary: r.epic.summary, description: r.epic.description || '' },
      tasks: (r.tasks || []).map((t) => ({ summary: t.summary, description: t.description || '', issuetype: t.issuetype || 'Task' })),
      projectKey,
    };
    setPlan(p);
    setStep('review');
    return p;
  }

  // ── Record a freshly generated/pasted result into history ──
  // If an input-stage draft is open, promote it (same entry) to a review draft.
  async function recordHistory(m: Mode, payload: UacTicket | EpicPlan) {
    try {
      if (inputDraftId) {
        await fetch(`/api/history/${inputDraftId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'review', mode: m, requirement, payload, created: false }),
        });
        setHistoryId(inputDraftId);
        setInputDraftId(null);
        return;
      }
      const r = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m, stage: 'review', lang, projectKey, issuetype, requirement, payload, created: false }),
      });
      const d = await r.json();
      if (d.ok) setHistoryId(d.entry.id);
    } catch { /* history is best-effort */ }
  }

  // ── Save the current input form as a draft (before generating) ──
  // asNew=false updates the open draft (if any); asNew=true always creates a new one.
  async function saveInputDraft(asNew = false) {
    const hasContent =
      requirement.trim() ||
      (inputTab === 'paste' && pasteText.trim()) ||
      (mode === 'epic' && inputTab === 'paste' && pasteTab === 'form' && builderPlan.epic.summary.trim());
    if (!hasContent) { setModalErr('Belum ada isi untuk disimpan jadi draft.'); return; }

    setSavingDraft(true); setErr(null);
    // Capture only the value relevant to the active input method, so a draft
    // matches its type (generate vs tempel manual) instead of storing everything.
    const method =
      inputTab === 'generate' ? 'generate'
      : mode === 'uac' ? 'paste-uac'
      : pasteTab === 'form' ? 'paste-form'
      : 'paste-json';
    const payload = {
      method,
      inputTab,
      pasteTab,
      requirement: method === 'generate' ? requirement : '',
      pasteText: method === 'paste-uac' || method === 'paste-json' ? pasteText : '',
      builderPlan: method === 'paste-form' ? builderPlan : emptyPlan(),
    };
    try {
      if (!asNew && inputDraftId) {
        await fetch(`/api/history/${inputDraftId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'input', requirement, payload, created: false }),
        });
      } else {
        await fetch('/api/history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, stage: 'input', lang, projectKey, issuetype, requirement, payload, created: false }),
        });
      }
      setSavingDraft(false);
      reset();          // clear the form
      setDraftSaved(true); // show success modal
    } catch {
      setSavingDraft(false);
      setModalErr('Gagal menyimpan draft.');
    }
  }

  // ── Submit a generation job for the Claude Code bridge to process ──
  async function generate() {
    setErr(null);
    if (!requirement.trim()) { setModalErr('Requirement masih kosong. Isi dulu sebelum generate.'); return; }
    const r = await fetch('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, lang, projectKey, issuetype, requirement }),
    });
    const d = await r.json();
    if (!d.ok) { setErr(d.error); return; }
    setJobId(d.job.id);
    setStep('generating');
    setJobStatus('pending');
    startPolling(d.job.id);
    triggerBridge();
  }

  // Poll a job until it finishes; the bridge (cron / terminal `/jira-web`) does the work.
  function startPolling(id: string) {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const jr = await fetch(`/api/jobs/${id}`).then((x) => x.json());
      if (!jr.ok) return;
      setJobStatus(jr.job.status);
      if (jr.job.status === 'done') {
        clearInterval(poll.current!);
        if (mode === 'uac') recordHistory('uac', loadUac(jr.job.result.markdown, jr.job.result.ticket));
        else recordHistory('epic', loadPlan(jr.job.result));
      } else if (jr.job.status === 'error') {
        clearInterval(poll.current!);
        setErr(jr.job.error || 'Generation gagal. Coba trigger ulang.');
        // stay on the generating step so the user can re-trigger Claude
      }
    }, 2000);
  }

  // Re-queue the current job so the Claude Code bridge reprocesses it.
  async function retryJob() {
    if (!jobId) return;
    setErr(null);
    const r = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
    const d = await r.json();
    if (!d.ok) { setErr(d.error); return; }
    setJobStatus('pending');
    startPolling(jobId);
    triggerBridge();
  }

  // Ask the local server to spawn `claude -p "/jira-web"` so the job is processed
  // without opening a terminal. Best-effort: on failure, fall back to manual run.
  async function triggerBridge() {
    setBridgeMsg('Menjalankan Claude…');
    try {
      const r = await fetch('/api/bridge', { method: 'POST' });
      const d = await r.json();
      setBridgeMsg(d.ok ? (d.message || 'Claude dijalankan.') : (d.error || 'Gagal menjalankan Claude.'));
    } catch {
      setBridgeMsg('Tidak bisa menghubungi server bridge.');
    }
  }

  // Cancel the running headless Claude bridge process.
  async function cancelBridge() {
    setBridgeMsg('Membatalkan bridge…');
    try {
      const r = await fetch('/api/bridge', { method: 'DELETE' });
      const d = await r.json();
      setBridgeMsg(d.message || 'Bridge dibatalkan.');
    } catch {
      setBridgeMsg('Gagal membatalkan bridge.');
    }
  }

  // ── Manual input fallback (paste output, or build via form) ──
  function applyPaste() {
    setErr(null);
    try {
      if (mode === 'uac') {
        if (!pasteText.trim()) throw new Error('Tempel markdown UAC dulu.');
        recordHistory('uac', loadUac(pasteText.trim()));
      } else if (pasteTab === 'form') {
        applyBuilder();
      } else {
        if (!pasteText.trim()) throw new Error('Tempel JSON breakdown dulu.');
        const parsed = JSON.parse(pasteText.trim());
        if (!parsed.epic || !Array.isArray(parsed.tasks)) throw new Error('JSON harus punya { epic, tasks }.');
        recordHistory('epic', loadPlan(parsed));
      }
    } catch (e) {
      setModalErr((e as Error).message);
    }
  }

  // Build an epic plan from the manual form builder (no AI, no paste).
  function applyBuilder() {
    if (!builderPlan.epic.summary.trim()) throw new Error('Isi Epic Summary dulu.');
    const tasks = builderPlan.tasks.filter((t) => t.summary.trim());
    if (tasks.length === 0) throw new Error('Tambah minimal satu child issue.');
    const p: EpicPlan = {
      epic: { summary: builderPlan.epic.summary, description: builderPlan.epic.description || '' },
      tasks: tasks.map((t) => ({ summary: t.summary, description: t.description || '', issuetype: t.issuetype || 'Task' })),
      projectKey: builderPlan.projectKey || projectKey,
    };
    setPlan(p);
    setStep('review');
    recordHistory('epic', p);
  }

  // ── Save current review payload as a draft (not pushed to JIRA) ──
  // asNew=false updates the open draft (if any); asNew=true always creates a new one.
  async function saveDraft(asNew = false) {
    const payload = mode === 'uac' ? uac : plan;
    if (!payload) return;
    setSavingDraft(true); setErr(null);
    try {
      if (!asNew && historyId) {
        await fetch(`/api/history/${historyId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'review', requirement, payload, created: false }),
        });
      } else {
        await fetch('/api/history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, stage: 'review', lang, projectKey, issuetype, requirement, payload, created: false }),
        });
      }
      setSavingDraft(false);
      reset();           // clear the form / leave review
      setDraftSaved(true); // show success modal
    } catch {
      setSavingDraft(false);
      setModalErr('Gagal menyimpan draft.');
    }
  }

  // ── Create the ticket(s) in JIRA ──
  async function create() {
    if (!configured) { setErr('Isi konfigurasi environment JIRA dulu.'); setShowEnv(true); return; }
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
    persistCreated(d);
  }

  // Update the history entry as created (or create one if none yet), with the
  // final edited payload and the JIRA result.
  async function persistCreated(result: any) {
    const payload = mode === 'uac' ? uac : plan;
    if (!payload) return;
    try {
      if (historyId) {
        await fetch(`/api/history/${historyId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, created: true, result }),
        });
      } else {
        await fetch('/api/history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, lang, projectKey, issuetype, requirement, payload, created: true, result }),
        });
      }
    } catch { /* best-effort */ }
  }

  function reset() {
    setStep('input'); setUac(null); setPlan(null); setResult(null); setHistoryId(null);
    setRequirement(''); setPasteText(''); setInputTab('generate'); setPasteTab('json');
    setBuilderPlan(emptyPlan()); setJobId(null); setErr(null); setDraftSaved(false); setInputDraftId(null);
    setBridgeMsg(''); setModalErr(null);
  }

  // ─────────────────────────── render ───────────────────────────
  return (
    <>
      {showEnv && (
        <EnvModal
          required={!configured}
          onClose={() => setShowEnv(false)}
          onSaved={(c) => { setConfigured(isConfigured(c)); if (isConfigured(c)) setShowEnv(false); }}
        />
      )}

      {modalErr && (
        <div className="modal-backdrop" onMouseDown={() => setModalErr(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>⚠️ Tidak bisa lanjut</h2>
              <button className="modal-x" onClick={() => setModalErr(null)} aria-label="Tutup">×</button>
            </div>
            <p>{modalErr}</p>
            <div className="btn-row">
              <button onClick={() => setModalErr(null)}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {draftSaved && (
        <div className="modal-backdrop" onMouseDown={() => setDraftSaved(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>✅ Draft tersimpan</h2>
              <button className="modal-x" onClick={() => setDraftSaved(false)} aria-label="Tutup">×</button>
            </div>
            <p className="hint">Draft disimpan dan form direset. Lanjutkan kapan saja dari menu Draft.</p>
            <div className="btn-row">
              <Link href="/draft" className="btn">Lihat Draft</Link>
              <button className="secondary" onClick={() => setDraftSaved(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Buat Tiket JIRA</h1>
          <p className="subtitle">UAC & breakdown dibuat lewat Claude Code (tanpa API berbayar). Tinjau & edit dulu, baru dikirim ke JIRA.</p>
        </div>
        <button className="secondary small" onClick={() => setShowEnv(true)}>⚙️ Environment</button>
      </div>

      {configured === false && (
        <div className="alert warn">Environment JIRA belum diisi. <button className="toggle-link" onClick={() => setShowEnv(true)}>Isi sekarang</button>.</div>
      )}

      {err && <div className="alert err">{err}</div>}

      {step === 'input' && (
        <>
          {inputDraftId && (
            <div className="alert info">
              Mengedit draft <code className="mono">{inputDraftId}</code>. <strong>Update draft</strong> menimpa draft ini; <strong>Simpan draft baru</strong> membuat draft terpisah.
            </div>
          )}
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
            <div className="tabs">
              <div className={`tab ${inputTab === 'generate' ? 'active' : ''}`} onClick={() => setInputTab('generate')}>⚡ Generate via Claude Code</div>
              <div className={`tab ${inputTab === 'paste' ? 'active' : ''}`} onClick={() => setInputTab('paste')}>📋 Tempel Manual</div>
            </div>

            {inputTab === 'generate' ? (
              <>
                <p className="hint">
                  Tempel deskripsi fitur / requirement (bisa markdown). Dikirim ke Claude Code untuk diproses.
                  {mode === 'uac' && ' Tiap skenario UAC ditulis dalam bentuk Gherkin GIVEN / WHEN / THEN.'}
                </p>
                <textarea style={{ minHeight: 180 }} value={requirement} onChange={(e) => setRequirement(e.target.value)}
                  placeholder={mode === 'uac' ? 'mis. Sebagai user saya ingin reset password lewat email…' : 'mis. Modul pembayaran: integrasi gateway, riwayat transaksi, refund…'} />
              </>
            ) : mode === 'uac' ? (
              <>
                <p className="hint">Sudah punya hasil dari Claude (chat / CLI)? Tempel dokumen markdown UAC di sini (skenario GIVEN/WHEN/THEN).</p>
                <textarea style={{ minHeight: 180 }} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'# [feature] judul\n\n## Description\n…\n\n## User Acceptance Criteria (UAC)\n\n# 1. JUDUL\n\nGIVEN …,\nWHEN …,\nTHEN ….'} />
              </>
            ) : (
              <>
                <div className="tabs">
                  <div className={`tab ${pasteTab === 'json' ? 'active' : ''}`} onClick={() => setPasteTab('json')}>📄 Tempel JSON</div>
                  <div className={`tab ${pasteTab === 'form' ? 'active' : ''}`} onClick={() => setPasteTab('form')}>🧱 Builder (form)</div>
                </div>
                {pasteTab === 'json' ? (
                  <>
                    <p className="hint">Tempel JSON breakdown dari Claude: {'{ epic, tasks }'}.</p>
                    <textarea style={{ minHeight: 180 }} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                      placeholder={'{ "epic": { "summary": "…", "description": "…" }, "tasks": [ { "summary": "…", "description": "…", "issuetype": "Story" } ] }'} />
                  </>
                ) : (
                  <>
                    <p className="hint">Isi Epic + child issues lewat form. Tanpa AI — langsung tinjau & buat ke JIRA.</p>
                    <EpicEditor plan={builderPlan} onChange={setBuilderPlan} keyPlaceholder={envProjectKey} />
                  </>
                )}
              </>
            )}

            {!(inputTab === 'paste' && mode === 'epic' && pasteTab === 'form') && (
              <div className="row">
                {inputTab === 'generate' && (
                  <div>
                    <label>Bahasa prosa</label>
                    <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'id')}>
                      <option value="en">English</option>
                      <option value="id">Bahasa Indonesia</option>
                    </select>
                  </div>
                )}
                <div>
                  <label>Project Key <span className="opt">(kosong = default)</span></label>
                  <input type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder={envProjectKey || 'default dari konfigurasi'} />
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
            )}

            <div className="btn-row">
              {inputTab === 'generate'
                ? <button onClick={generate}>⚡ Generate via Claude Code</button>
                : <button onClick={applyPaste}>{inputTab === 'paste' && mode === 'epic' && pasteTab === 'form' ? 'Tinjau & lanjut' : 'Proses & tinjau'}</button>}
              {inputDraftId ? (
                <>
                  <button className="secondary" onClick={() => saveInputDraft(false)} disabled={savingDraft}>
                    {savingDraft ? 'Menyimpan…' : '💾 Update draft'}
                  </button>
                  <button className="secondary" onClick={() => saveInputDraft(true)} disabled={savingDraft}>💾 Simpan draft baru</button>
                </>
              ) : (
                <button className="secondary" onClick={() => saveInputDraft(false)} disabled={savingDraft}>
                  {savingDraft ? 'Menyimpan…' : '💾 Simpan draft'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {step === 'generating' && (
        <div className="card">
          <h2>
            {jobStatus === 'error' ? '⚠️ Generation gagal' : <><span className="spinner" /> Menunggu Claude Code…</>}
          </h2>
          <p className="hint">Job <code className="mono">{jobId}</code> — status: <strong>{jobStatus}</strong></p>
          <div className={`alert ${jobStatus === 'error' ? 'warn' : 'info'}`}>
            Server menjalankan <code className="mono">claude -p "/jira-web"</code> otomatis untuk memproses
            job ini (tanpa biaya API), lalu hasilnya muncul di sini. Kalau <code className="mono">claude</code> tidak
            tersedia di server, jalankan manual di terminal: <code className="mono">/jira-web</code> (atau{' '}
            <code className="mono">npm run bridge</code>).
            Klik <strong>Trigger ulang Claude</strong> untuk mengantri & menjalankan ulang (mis. jika tersangkut atau gagal).
          </div>
          {bridgeMsg && <p className="hint">⚙️ {bridgeMsg}</p>}
          <div className="btn-row">
            <button onClick={retryJob}>🔄 Trigger ulang Claude</button>
            <button className="secondary" onClick={cancelBridge}>⛔ Batalkan bridge</button>
            <button className="secondary" onClick={() => { if (poll.current) clearInterval(poll.current); cancelBridge(); reset(); }}>Batal & kembali</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className="alert ok">Hasil siap. Tinjau & edit di bawah, lalu simpan draft atau buat tiketnya.</div>
          {historyId && (
            <div className="alert info">
              Draft tersimpan: <code className="mono">{historyId}</code>. <strong>Update draft</strong> menimpa; <strong>Simpan draft baru</strong> membuat salinan.
            </div>
          )}
          {mode === 'uac' && uac && <UacEditor ticket={uac} onChange={setUac} keyPlaceholder={envProjectKey} />}
          {mode === 'epic' && plan && <EpicEditor plan={plan} onChange={setPlan} keyPlaceholder={envProjectKey} />}
          <div className="btn-row">
            <button className="green" onClick={create} disabled={creating || savingDraft}>
              {creating ? <><span className="spinner" /> Membuat…</> : '🚀 Buat ke JIRA'}
            </button>
            {historyId ? (
              <>
                <button className="secondary" onClick={() => saveDraft(false)} disabled={savingDraft || creating}>
                  {savingDraft ? 'Menyimpan…' : '💾 Update draft'}
                </button>
                <button className="secondary" onClick={() => saveDraft(true)} disabled={savingDraft || creating}>💾 Simpan draft baru</button>
              </>
            ) : (
              <button className="secondary" onClick={() => saveDraft(false)} disabled={savingDraft || creating}>
                {savingDraft ? 'Menyimpan…' : '💾 Simpan draft'}
              </button>
            )}
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
