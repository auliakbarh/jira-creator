import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, saveConfig, maskConfig, StoredConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = await loadConfig();
  return NextResponse.json(maskConfig(cfg));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<StoredConfig>;
  const current = await loadConfig();

  // Keep the existing token when the client sends the mask placeholder or blank.
  const apiToken =
    body.apiToken && !body.apiToken.startsWith('••') ? body.apiToken : current.apiToken;

  const next: StoredConfig = {
    baseUrl: (body.baseUrl ?? current.baseUrl).trim(),
    email: (body.email ?? current.email).trim(),
    apiToken,
    projectKey: (body.projectKey ?? current.projectKey).trim(),
    defaultIssueType: (body.defaultIssueType ?? current.defaultIssueType).trim() || 'Task',
    defaultPriority: (body.defaultPriority ?? current.defaultPriority).trim() || 'Medium',
  };
  await saveConfig(next);
  return NextResponse.json(maskConfig(next));
}

// Clear all stored credentials (reset to empty defaults).
export async function DELETE() {
  const empty: StoredConfig = {
    baseUrl: '', email: '', apiToken: '', projectKey: '', defaultIssueType: 'Task', defaultPriority: 'Medium',
  };
  await saveConfig(empty);
  return NextResponse.json(maskConfig(empty));
}
