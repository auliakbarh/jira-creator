import './globals.css';
import type { Metadata } from 'next';
import Nav from './components/Nav';

export const metadata: Metadata = {
  title: 'JIRA Creator',
  description: 'Buat UAC & breakdown tiket JIRA via Claude Code, lalu buat tiketnya — tanpa API berbayar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
