'use client';

import { useEffect, useRef, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/nord.css';

interface MarkdownPreviewProps {
  markdown: string;
  theme?: 'light' | 'dark';
}

const InPreContext = createContext<boolean>(false);

// Module-level in-memory cache for rendered Mermaid SVGs: key = `${theme}:${code}`
const mermaidSvgCache = new Map<string, string>();

export default function MarkdownPreview({ markdown, theme = 'light' }: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Explicit color tokens to avoid OS prefers-color-scheme bleeding into light mode
  const headingColor = isDark ? '#f8fafc' : '#0f172a';
  const bodyColor = isDark ? '#cbd5e1' : '#334155';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  // 1. Initialize mermaid ONLY when theme changes (NOT on every keystroke)
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'base',
      securityLevel: 'strict',
      fontFamily: 'var(--font-plus-jakarta-sans), Inter, system-ui, sans-serif',
      themeVariables: isDark
        ? {
            primaryColor: '#1e293b',
            primaryBorderColor: '#475569',
            primaryTextColor: '#f8fafc',
            lineColor: '#60a5fa',
            secondaryColor: '#0f172a',
            secondaryBorderColor: '#334155',
            secondaryTextColor: '#f8fafc',
            tertiaryColor: '#1e293b',
            tertiaryBorderColor: '#475569',
            tertiaryTextColor: '#f8fafc',
            background: 'transparent',
            mainBkg: '#1e293b',
            secondBkg: '#0f172a',
            tertiaryBkg: '#1e293b',
            edgeLabelBackground: '#1e293b',
            fontFamily: 'var(--font-plus-jakarta-sans), Inter, system-ui, sans-serif',
          }
        : {
            primaryColor: '#ffffff',
            primaryBorderColor: '#2563eb',
            primaryTextColor: '#0f172a',
            lineColor: '#2563eb',
            secondaryColor: '#ffffff',
            secondaryBorderColor: '#3b82f6',
            secondaryTextColor: '#0f172a',
            tertiaryColor: '#f8fafc',
            tertiaryBorderColor: '#64748b',
            tertiaryTextColor: '#0f172a',
            background: 'transparent',
            mainBkg: '#ffffff',
            secondBkg: '#f8fafc',
            tertiaryBkg: '#f1f5f9',
            edgeLabelBackground: '#ffffff',
            fontFamily: 'var(--font-plus-jakarta-sans), Inter, system-ui, sans-serif',
          },
    });
  }, [isDark]);

  // 2. Debounced background rendering for uncached Mermaid diagrams
  useEffect(() => {
    let isCancelled = false;

    const timeoutId = setTimeout(async () => {
      if (!previewRef.current) return;
      const elements = previewRef.current.querySelectorAll<HTMLElement>('.mermaid-diagram:not(.mermaid-rendered)');

      for (let i = 0; i < elements.length; i++) {
        if (isCancelled) break;
        const el = elements[i];
        const code = el.getAttribute('data-code') || '';
        const elTheme = el.getAttribute('data-theme') || theme;
        if (!code.trim()) continue;

        const cacheKey = `${elTheme}:${code}`;
        if (mermaidSvgCache.has(cacheKey)) {
          el.innerHTML = mermaidSvgCache.get(cacheKey)!;
          el.classList.add('mermaid-rendered');
          continue;
        }

        try {
          const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
          const { svg } = await mermaid.render(id, code);
          if (isCancelled) break;
          mermaidSvgCache.set(cacheKey, svg);
          el.innerHTML = svg;
          el.classList.add('mermaid-rendered');
        } catch (error) {
          console.error('Mermaid render error:', error);
          if (!isCancelled) {
            el.innerHTML = `<div class="text-red-500 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs">Diagram syntax error: ${error instanceof Error ? error.message : 'Invalid Mermaid syntax'}</div>`;
            el.classList.add('mermaid-rendered');
          }
        }
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [markdown, theme]);

  return (
    <div
      ref={previewRef}
      id="markdown-preview"
      className={`prose prose-lg max-w-none px-12 py-8 transition-colors ${
        isDark ? 'prose-invert bg-slate-900' : 'bg-white'
      }`}
      style={{
        color: bodyColor,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false }]]}
        components={{
          h1: ({ children }) => (
            <h1
              className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-8 mb-5 leading-tight"
              style={{ color: headingColor }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight mt-8 mb-4 leading-snug"
              style={{ color: headingColor }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-3"
              style={{ color: headingColor }}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              className="text-lg sm:text-xl font-semibold tracking-tight mt-4 mb-2"
              style={{ color: headingColor }}
            >
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5
              className="text-base sm:text-lg font-semibold mt-3 mb-2"
              style={{ color: headingColor }}
            >
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6
              className="text-sm sm:text-base font-semibold mt-3 mb-2"
              style={{ color: mutedColor }}
            >
              {children}
            </h6>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-700 underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className="my-4 leading-relaxed" style={{ color: bodyColor }}>
              {children}
            </p>
          ),
          code({ node, inline, className, children, ...props }: any) {
            const isInPre = useContext(InPreContext);
            const match = /language-(\w+)/.exec(className || '');
            const lang = match?.[1];
            const codeString = String(children).replace(/\n$/, '');

            // Handle mermaid diagrams
            if (lang === 'mermaid') {
              const cacheKey = `${theme}:${codeString}`;
              const cachedSvg = mermaidSvgCache.get(cacheKey);

              // If already cached, render immediately without delay or flash
              if (cachedSvg) {
                return (
                  <div
                    className="mermaid-diagram mermaid-rendered not-prose w-full flex justify-center items-center py-2"
                    data-code={codeString}
                    data-theme={theme}
                    dangerouslySetInnerHTML={{ __html: cachedSvg }}
                  />
                );
              }

              return (
                <div
                  className="mermaid-diagram not-prose w-full flex justify-center items-center py-2 min-h-[90px]"
                  data-code={codeString}
                  data-theme={theme}
                >
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Rendering diagram...
                  </div>
                </div>
              );
            }

            // Inline code (e.g. `grid[10000][10000]`) - only when NOT inside <pre>
            if (!isInPre) {
              return (
                <code
                  className="not-prose inline-block px-1.5 py-0.5 rounded-md font-mono text-[0.88em] font-medium border transition-colors"
                  style={{
                    color: isDark ? '#f472b6' : '#db2777',
                    backgroundColor: isDark ? 'rgba(244, 114, 182, 0.12)' : '#fdf2f8',
                    borderColor: isDark ? 'rgba(244, 114, 182, 0.28)' : '#fbcfe8',
                  }}
                >
                  {children}
                </code>
              );
            }

            // Code blocks inside <pre>
            return (
              <code
                className={`${className || ''} !bg-transparent !p-0 font-mono`}
                style={{
                  backgroundColor: 'transparent',
                  padding: 0,
                  color: '#f8fafc',
                  fontFamily: 'ui-monospace, Menlo, Monaco, SFMono-Regular, "Cascadia Code", Consolas, "Liberation Mono", monospace',
                  letterSpacing: '0px',
                  fontVariantEastAsian: 'normal',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children, node }: any) => {
            const codeChild = node?.children?.find((c: any) => c.type === 'element' && c.tagName === 'code');
            const classList = codeChild?.properties?.className;
            const isMermaidFromNode = Array.isArray(classList)
              ? classList.some((c: string) => String(c).includes('mermaid'))
              : typeof classList === 'string' && classList.includes('mermaid');
            const isMermaidFromChildren =
              (children as any)?.props?.className?.includes?.('mermaid') ||
              (children as any)?.props?.['data-code'] !== undefined;

            if (isMermaidFromNode || isMermaidFromChildren) {
              return (
                <InPreContext.Provider value={true}>
                  <div
                    data-mermaid-container="true"
                    className={`not-prose my-6 p-6 rounded-xl overflow-x-auto flex justify-center items-center border transition-colors ${
                      isDark
                        ? 'bg-slate-800/60 border-slate-700/80 shadow-xs'
                        : 'bg-slate-50 border-slate-200/90 shadow-xs'
                    }`}
                  >
                    {children}
                  </div>
                </InPreContext.Provider>
              );
            }

            return (
              <InPreContext.Provider value={true}>
                <pre
                  className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-700/80 shadow-sm font-mono text-slate-100"
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    padding: '1.25rem 1.5rem',
                    margin: '1.5rem 0',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    fontFamily: 'ui-monospace, Menlo, Monaco, SFMono-Regular, "Cascadia Code", Consolas, "Liberation Mono", monospace',
                    letterSpacing: '0px',
                    fontVariantEastAsian: 'normal',
                    whiteSpace: 'pre',
                    wordSpacing: 'normal',
                    tabSize: 4,
                  }}
                >
                  {children}
                </pre>
              </InPreContext.Provider>
            );
          },
          hr: () => (
            <hr
              className="my-6 border-t border-slate-200 dark:border-slate-800"
            />
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside my-4 ml-6 space-y-1" style={{ color: bodyColor }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside my-4 ml-6 space-y-1" style={{ color: bodyColor }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1" style={{ color: bodyColor }}>
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-4 border-blue-500 pl-4 italic my-4"
              style={{ color: mutedColor }}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table
                className={`min-w-full border-collapse ${
                  isDark ? 'border border-slate-700' : 'border border-slate-300'
                }`}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-100'}>
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className={isDark ? 'bg-slate-900' : 'bg-white'}>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-slate-200'}>
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th
              className={`px-4 py-3 text-left text-sm font-bold border-r ${
                isDark
                  ? 'text-slate-100 border-slate-700'
                  : 'text-slate-900 border-slate-200'
              }`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={`px-4 py-3 text-sm border-r ${
                isDark
                  ? 'text-slate-300 border-slate-700'
                  : 'text-slate-700 border-slate-200'
              }`}
            >
              {children}
            </td>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
