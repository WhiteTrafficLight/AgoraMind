import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AgoraMind - Top Podcasts',
  description: 'Listen to the most thought-provoking philosophical discussions with the greatest minds of all time.',
};

export default function PodcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>{children}</>
  );
} 