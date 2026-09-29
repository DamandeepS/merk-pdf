'use client';

import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
      <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-medium tracking-wide">Loading MerkPDF Studio...</span>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="h-screen">
      <MarkdownEditor />
    </main>
  );
}
