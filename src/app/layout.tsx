import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navigation, SkipToContent } from '@/components/layout';
import { ThemeProvider } from '@/components/theme';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SkipToContent />
          <Navigation />
          <main id="main-content">{children}</main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
