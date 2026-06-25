import { NextResponse } from 'next/server';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

// Track the running headless Claude so we can guard against overlap and cancel it.
// (Per server process; headless `claude -p` drains pending jobs then exits.)
let child: ChildProcess | null = null;

function claudeAvailable(): boolean {
  try {
    const r = spawnSync('claude', ['--version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

// Status of the bridge process.
export async function GET() {
  return NextResponse.json({ ok: true, running: child !== null, pid: child?.pid ?? null });
}

// Spawn Claude Code headlessly to run the /jira-web skill, which drains any
// pending job files and writes their results — no terminal needed. The web UI's
// existing job polling then picks up the results.
export async function POST() {
  if (child) return NextResponse.json({ ok: true, already: true, message: 'Bridge sedang berjalan.' });

  if (!claudeAvailable()) {
    return NextResponse.json(
      { ok: false, error: "CLI 'claude' tidak ditemukan di PATH server. Pasang Claude Code / login dulu." },
      { status: 503 },
    );
  }

  // The skill lives in the project root (.claude/commands/jira-web.md); the Next
  // server runs in web/, so the project root is one level up.
  const projectRoot = path.join(process.cwd(), '..');

  try {
    // detached → own process group, so cancel can kill the whole tree.
    const c = spawn(
      'claude',
      ['-p', '--permission-mode', 'acceptEdits', '/jira-web'],
      { cwd: projectRoot, env: process.env, detached: true, stdio: 'ignore' },
    );
    child = c;
    c.on('error', () => { if (child === c) child = null; });
    c.on('exit', () => { if (child === c) child = null; });
    c.unref();
    return NextResponse.json({ ok: true, message: 'Claude dijalankan — memproses job…', pid: c.pid });
  } catch (e) {
    child = null;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// Cancel the running bridge process (kills its whole process group).
export async function DELETE() {
  if (!child || !child.pid) return NextResponse.json({ ok: true, running: false, message: 'Tidak ada bridge berjalan.' });
  const pid = child.pid;
  try {
    process.kill(-pid, 'SIGTERM');   // negative pid = kill the detached process group
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  child = null;
  return NextResponse.json({ ok: true, running: false, message: 'Bridge dibatalkan.' });
}
