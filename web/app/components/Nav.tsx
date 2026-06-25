'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Nav() {
  const path = usePathname();
  const [conn, setConn] = useState<'unknown' | 'ok' | 'bad'>('unknown');
  const [who, setWho] = useState<string>('');

  useEffect(() => {
    fetch('/api/jira/whoami')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setConn('ok'); setWho(d.name); }
        else setConn('bad');
      })
      .catch(() => setConn('bad'));
  }, [path]);

  const link = (href: string, label: string) => (
    <Link href={href} className={`link ${path === href ? 'active' : ''}`}>{label}</Link>
  );

  return (
    <nav className="nav">
      <Link href="/" className="brand">🎫 JIRA Creator</Link>
      {link('/', 'Buat Tiket')}
      {link('/history', 'Riwayat')}
      {link('/config', 'Konfigurasi')}
      <span className="spacer" />
      <span className="muted" title="Status koneksi JIRA">
        <span className={`status-dot ${conn}`} />
        {conn === 'ok' ? who || 'Terhubung' : conn === 'bad' ? 'Belum terhubung' : 'Memeriksa…'}
      </span>
    </nav>
  );
}
