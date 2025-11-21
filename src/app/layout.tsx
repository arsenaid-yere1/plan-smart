import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plan Smart - Retirement Planning',
  description: 'Smart retirement planning made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
