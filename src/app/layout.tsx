import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AI } from './actions';
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nasa chat bot',
  description: 'Get Nasa Information With AIs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AI>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </AI>
  );
}
