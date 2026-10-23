import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VendorFlow — AI-Powered Vendor Onboarding SaaS',
  description:
    'Generate structured onboarding workflows from plain English, collect and verify vendor certificates, and automatically track document expirations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900 flex flex-col font-sans">
        <div className="flex h-screen overflow-hidden">
          <Suspense fallback={<div className="w-64 h-full bg-slate-900 border-r border-slate-800 hidden lg:block" />}>
            <Sidebar />
          </Suspense>
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
