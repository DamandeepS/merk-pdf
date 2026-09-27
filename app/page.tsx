'use client';

import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="h-screen">
      <MarkdownEditor />
    </main>
  );
}
