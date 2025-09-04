import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/ui/Header';
import { Providers } from './providers';
// import Footer from '@/components/ui/Footer';

export const metadata: Metadata = {
  title: 'AgoraMind',
  description: 'AI-powered chat application',
};

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <Providers>
        <Header />
        <main className="flex-grow">{children}</main>
        {/* <Footer /> */}
        </Providers>
      </body>
    </html>
  );
}
