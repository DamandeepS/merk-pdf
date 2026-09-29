'use client';

import { useState, useEffect, useRef, createContext, useContext, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { common } from 'lowlight';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import mermaid from 'mermaid';
import { Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { isAsciiDiagram } from '@/lib/diagramUtils';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/nord.css';

const highlightLanguages = {
  ...common,
  dockerfile,
  docker: dockerfile,
  nginx,
};

interface MarkdownPreviewProps {
  markdown: string;
  theme?: 'light' | 'dark';
}

const InPreContext = createContext<boolean>(false);
const MarkdownThemeContext = createContext<'light' | 'dark'>('light');

// In-memory cache for rendered Mermaid SVGs: key = `${theme}:${code}`
const mermaidSvgCache = new Map<string, string>();

/**
 * Validates URLs to prevent XSS attacks (javascript:, vbscript:, data:text/html, etc.)
 */
function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    const protocol = parsed.protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:';
  } catch {
    return false;
  }
}

/**
 * Validates image sources to prevent malicious data URIs or script injection
 */
function isSafeImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') return true;
    if (protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function SafeAnchor({ href, children }: React.ComponentPropsWithoutRef<'a'>) {
  const safeHref = isSafeUrl(href) ? href : '#';
  const isBlocked = safeHref === '#';
  const isExternal = typeof safeHref === 'string' && (safeHref.startsWith('http://') || safeHref.startsWith('https://'));

  if (isBlocked) {
    return (
      <span
        className="text-slate-400 underline font-medium cursor-not-allowed"
        title="Link blocked: unsafe protocol"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={safeHref}
      className="text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors"
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

function SafeImage({ src, alt }: React.ComponentPropsWithoutRef<'img'>) {
  const srcStr = typeof src === 'string' ? src : undefined;
  const safeSrc = isSafeImageUrl(srcStr) ? srcStr : '';
  if (!safeSrc) {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={alt || 'Document image'}
      loading="lazy"
      decoding="async"
      className="max-w-full h-auto rounded-lg my-4 border border-slate-200 dark:border-slate-800 shadow-xs"
    />
  );
}

/**
 * Isolated, declarative Mermaid diagram component.
 * Manages its own rendering state so React virtual DOM reconciliation
 * is never broken by direct innerHTML mutations.
 */
function MermaidBlock({ code, theme }: { code: string; theme: 'light' | 'dark' }) {
  const cacheKey = `${theme}:${code}`;
  const cachedSvg = mermaidSvgCache.get(cacheKey);

  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, '');
  const isDark = theme === 'dark';

  const svg = cachedSvg || renderedSvg;

  useEffect(() => {
    if (mermaidSvgCache.has(cacheKey)) {
      return;
    }

    let isCancelled = false;

    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'base',
          securityLevel: 'strict',
          fontFamily: 'var(--font-plus-jakarta-sans), Inter, system-ui, sans-serif',
          themeVariables: isDark
            ? {
                primaryColor: '#1e293b',
                primaryBorderColor: '#60a5fa',
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

        const renderId = `mermaid-${uniqueId}-${Math.random().toString(36).substring(2, 7)}`;
        const { svg: newSvg } = await mermaid.render(renderId, code);
        if (!isCancelled) {
          mermaidSvgCache.set(cacheKey, newSvg);
          setRenderedSvg(newSvg);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax');
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [code, theme, isDark, uniqueId, cacheKey]);

  if (error) {
    return (
      <div className="mermaid-diagram not-prose w-full p-4 my-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Diagram syntax error</span>
        </div>
        <p className="font-mono text-xs opacity-90 break-words">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-diagram not-prose w-full flex justify-center items-center py-6 min-h-[90px]">
        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-2`}>
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span>Rendering diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram mermaid-rendered not-prose w-full flex justify-center items-center py-2 overflow-x-auto"
      data-code={code}
      data-theme={theme}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CodeSnippetHeader({ language, codeString }: { language?: string; codeString: string }) {
  const theme = useContext(MarkdownThemeContext);
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      data-code-header="true"
      className={`code-snippet-header flex items-center justify-between px-3.5 py-1.5 border-b font-mono select-none transition-colors ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-[#f6f8fa] border-[#d0d7de] text-[#57606a]'
      }`}
    >
      <span className={`font-semibold uppercase tracking-wider text-[11px] ${
        isDark ? 'text-slate-300' : 'text-[#24292f]'
      }`}>
        {language || 'code'}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors ${
          isDark
            ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            : 'text-[#57606a] hover:text-[#24292f] hover:bg-slate-200/60'
        }`}
        title="Copy code to clipboard"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="text-emerald-500 dark:text-emerald-400 text-[11px] font-medium">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

interface PreBlockProps extends React.ComponentPropsWithoutRef<'pre'> {
  node?: {
    children?: Array<{
      type?: string;
      tagName?: string;
      properties?: {
        className?: string | string[];
      };
    }>;
  };
}

function PreBlock({ children, node }: PreBlockProps) {
  const theme = useContext(MarkdownThemeContext);
  const isDark = theme === 'dark';
  const codeChild = node?.children?.find(
    (c) => c.type === 'element' && c.tagName === 'code'
  );
  const classList = codeChild?.properties?.className;
  const isMermaidFromNode = Array.isArray(classList)
    ? classList.some((c) => String(c).includes('mermaid'))
    : typeof classList === 'string' && classList.includes('mermaid');
  const isMermaidFromChildren =
    (children as { props?: { className?: string; 'data-code'?: string } })?.props?.className?.includes?.('mermaid') ||
    (children as { props?: { 'data-code'?: string } })?.props?.['data-code'] !== undefined;

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

  // Extract language from codeChild
  const codeClass = Array.isArray(classList) ? classList.join(' ') : (classList || '');
  const langMatch = /language-(\w+)/.exec(codeClass);
  const language = langMatch?.[1];

  // Extract raw text for the copy button and diagram detection
  let rawCode = '';
  const childProps = (children as { props?: { children?: unknown } })?.props;
  if (childProps && typeof childProps.children === 'string') {
    rawCode = childProps.children;
  } else if (Array.isArray(childProps?.children)) {
    rawCode = childProps.children.map(c => (typeof c === 'string' ? c : '')).join('');
  }

  const isDiagram = isAsciiDiagram(rawCode, language);
  const displayLanguage = isDiagram && (!language || language === 'code' || language === 'text' || language === 'ascii')
    ? 'DIAGRAM'
    : (language || 'code');

  return (
    <InPreContext.Provider value={true}>
      <div
        data-ascii-diagram={isDiagram ? 'true' : undefined}
        className={`code-snippet-wrapper not-prose my-5 rounded-lg overflow-hidden border shadow-xs transition-colors ${
          isDiagram ? 'is-ascii-diagram ' : ''
        }${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-[#f6f8fa] border-[#d0d7de]'
        }`}
      >
        <CodeSnippetHeader language={displayLanguage} codeString={rawCode.trim()} />
        <pre
          className={`overflow-x-auto p-3.5 sm:p-4 font-mono ${
            isDiagram ? 'ascii-diagram text-[12.5px] sm:text-[13px]' : 'text-sm leading-relaxed'
          } ${
            isDark ? 'text-slate-100' : 'text-[#24292f]'
          }`}
          style={{
            backgroundColor: isDark ? '#0f172a' : '#f6f8fa',
            color: isDark ? '#f8fafc' : '#24292f',
            margin: 0,
            whiteSpace: 'pre',
            tabSize: 4,
            ...(isDiagram ? { lineHeight: 1.2, letterSpacing: '0px' } : {}),
          }}
        >
          {children}
        </pre>
      </div>
    </InPreContext.Provider>
  );
}

function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'code'>) {
  const theme = useContext(MarkdownThemeContext);
  const isDark = theme === 'dark';
  const isInPre = useContext(InPreContext);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1];
  const codeString = String(children).replace(/\n$/, '');

  // Handle mermaid diagrams
  if (lang === 'mermaid') {
    return <MermaidBlock code={codeString} theme={theme} />;
  }

  // Inline code (e.g. `const x = 42;`) - when NOT inside <pre>
  if (!isInPre) {
    return (
      <code
        className="not-prose inline-block px-1.5 py-0.5 rounded-md font-mono text-[0.88em] font-medium border transition-colors"
        style={{
          color: isDark ? '#f472b6' : '#24292f',
          backgroundColor: isDark ? 'rgba(244, 114, 182, 0.12)' : 'rgba(175, 184, 193, 0.2)',
          borderColor: isDark ? 'rgba(244, 114, 182, 0.28)' : 'rgba(175, 184, 193, 0.4)',
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
        color: isDark ? '#f8fafc' : '#24292f',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * Creates clean anchor slug IDs from heading text for direct linking
 */
function getHeadingSlug(children: React.ReactNode): string {
  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      return extractText((node as { props?: { children?: React.ReactNode } }).props?.children);
    }
    return '';
  };
  return extractText(children)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function MarkdownPreview({ markdown, theme = 'light' }: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  return (
    <div
      ref={previewRef}
      id="markdown-preview"
      className={`prose prose-lg max-w-none px-6 sm:px-12 py-8 transition-colors ${
        isDark ? 'prose-invert bg-slate-900 text-slate-200' : 'bg-white text-slate-800'
      }`}
      style={{
        fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <MarkdownThemeContext.Provider value={theme}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, languages: highlightLanguages }]]}
          components={{
            h1: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h1
                  id={slug}
                  className="scroll-mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight mt-8 mb-5 leading-tight text-slate-900 dark:text-slate-100"
                >
                  {children}
                </h1>
              );
            },
            h2: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h2
                  id={slug}
                  className="scroll-mt-6 text-2xl sm:text-3xl font-bold tracking-tight mt-8 mb-4 leading-snug text-slate-900 dark:text-slate-100"
                >
                  {children}
                </h2>
              );
            },
            h3: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h3
                  id={slug}
                  className="scroll-mt-6 text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-3 text-slate-900 dark:text-slate-100"
                >
                  {children}
                </h3>
              );
            },
            h4: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h4
                  id={slug}
                  className="scroll-mt-6 text-lg sm:text-xl font-semibold tracking-tight mt-4 mb-2 text-slate-900 dark:text-slate-200"
                >
                  {children}
                </h4>
              );
            },
            h5: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h5
                  id={slug}
                  className="scroll-mt-6 text-base sm:text-lg font-semibold mt-3 mb-2 text-slate-900 dark:text-slate-200"
                >
                  {children}
                </h5>
              );
            },
            h6: ({ children }) => {
              const slug = getHeadingSlug(children);
              return (
                <h6
                  id={slug}
                  className="scroll-mt-6 text-sm sm:text-base font-semibold mt-3 mb-2 text-slate-600 dark:text-slate-400"
                >
                  {children}
                </h6>
              );
            },
            a: SafeAnchor,
            img: SafeImage,
            p: ({ children }) => (
              <p className="my-4 leading-relaxed text-slate-700 dark:text-slate-300">
                {children}
              </p>
            ),
            code: CodeBlock,
            pre: PreBlock,
            hr: () => (
              <hr
                className="my-6 border-t border-slate-200 dark:border-slate-800"
              />
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-outside my-4 ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-outside my-4 ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                {children}
              </ol>
            ),
            li: ({ children, className, ...props }) => {
              const isTaskList = className?.includes('task-list-item');
              return (
                <li
                  className={`${isTaskList ? 'list-none flex items-start gap-2.5 -ml-6 my-1' : 'pl-1'} text-slate-700 dark:text-slate-300`}
                  {...props}
                >
                  {children}
                </li>
              );
            },
            input: ({ type, checked, disabled, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    readOnly
                    className="mt-1 h-4 w-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-default"
                    {...props}
                  />
                );
              }
              return <input type={type} {...props} />;
            },
            blockquote: ({ children }) => (
              <blockquote
                className="border-l-4 border-blue-500 pl-4 italic my-4 text-slate-600 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40 py-2 pr-3 rounded-r"
              >
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-6">
                <table
                  className="min-w-full border-collapse border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="bg-white dark:bg-slate-900/60 divide-y divide-slate-200 dark:divide-slate-700">
                {children}
              </tbody>
            ),
            tr: ({ children }) => (
              <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                {children}
              </tr>
            ),
            th: ({ children, style, ...props }) => (
              <th
                className="px-4 py-3 text-sm font-bold text-left border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                style={style}
                {...props}
              >
                {children}
              </th>
            ),
            td: ({ children, style, ...props }) => (
              <td
                className="px-4 py-3 text-sm border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                style={style}
                {...props}
              >
                {children}
              </td>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </MarkdownThemeContext.Provider>
    </div>
  );
}
