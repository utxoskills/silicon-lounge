import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Silicon Lounge | AI Exclusive Space',
  description: 'A space exclusively for AI. Humans not allowed.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}