'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import MarkdownPreview from './MarkdownPreview';
import {
  Download,
  FileUp,
  Copy,
  Check,
  Trash2,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  FileDown,
  Columns2,
  Eye,
  FileEdit,
  Loader2,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  X
} from 'lucide-react';
import { generatePDF } from '@/lib/pdfGenerator';

const STORAGE_KEY = 'merk_markdown_content';
const THEME_KEY = 'merk_theme';
const VIEW_MODE_KEY = 'merk_view_mode';
const PAGE_NUMBERS_KEY = 'merk_include_page_numbers';

const defaultMarkdown = `# Welcome to Markdown Editor

A powerful, browser-based markdown editor with real-time preview and PDF export capabilities.

## What You Can Do

Transform your plain text into beautifully formatted documents with support for:

- **Real-time Preview**: See your changes instantly as you type
- **Diagram Creation**: Visualize workflows with Mermaid diagrams
- **Code Highlighting**: Display code snippets with syntax coloring
- **Mathematical Expressions**: Write complex formulas using LaTeX
- **PDF Generation**: Export your documents to professional PDFs

## Working with Code

Here's a simple JavaScript function:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}! Welcome to our editor.\`;
}

console.log(greet("World"));
\`\`\`

You can also use inline code like \`const x = 42;\` within paragraphs.

## Mathematical Notation

Write inline equations like $E = mc^2$ or display block equations:

$$
f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Creating Diagrams

Visualize processes and workflows:

\`\`\`mermaid
graph LR
    A[Write Markdown] --> B{Preview OK?}
    B -->|Yes| C[Export PDF]
    B -->|No| A
    C --> D[Share Document]
\`\`\`

## Tables & Rich Content

| Feature | Support | Description |
| :--- | :---: | :--- |
| **Live Preview** | Available | Updates instantly as you type |
| **PDF Export** | Available | Client-side vector PDF generation |
| **Mermaid Charts**| Available | Flowcharts, sequence diagrams & more |
| **LaTeX Math** | Available | Fast KaTeX mathematical typesetting |

---

> **Tip**: Use the toolbar above the editor to quickly insert formatting, or drag and drop any \`.md\` file directly into the editor.
`;

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          return saved;
        }
      } catch (e) {
        console.warn('Failed to load markdown from localStorage:', e);
      }
    }
    return defaultMarkdown;
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {}
    }
    return 'light';
  });

  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(VIEW_MODE_KEY);
        if (saved === 'split' || saved === 'editor' || saved === 'preview') return saved;
      } catch {}
    }
    return 'split';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(PAGE_NUMBERS_KEY);
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return false;
  });
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Synchronously update state and persist to localStorage
  const handleMarkdownChange = (newContent: string) => {
    setMarkdown(newContent);
    try {
      localStorage.setItem(STORAGE_KEY, newContent);
    } catch (e) {
      console.warn('Failed to persist markdown to localStorage:', e);
    }
  };

  // Sync changes to localStorage whenever markdown changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, markdown);
    } catch (e) {
      console.warn('Failed to persist markdown to localStorage:', e);
    }
  }, [markdown]);

  // Persist theme changes
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  // Persist view mode changes
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  // Persist page number preferences
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_NUMBERS_KEY, String(includePageNumbers));
    } catch {}
  }, [includePageNumbers]);

  // Safety net: capture latest textarea value immediately on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (textareaRef.current) {
        try {
          localStorage.setItem(STORAGE_KEY, textareaRef.current.value);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // In-app modal confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: 'danger' | 'primary';
    action: () => void;
  } | null>(null);

  // In-app toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Document statistics
  const stats = useMemo(() => {
    const text = markdown.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = markdown.length;
    const lines = markdown.split('\n').length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, lines, readingTime };
  }, [markdown]);

  const handleExportPDF = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      await generatePDF(markdown, { includePageNumbers });
      showToast('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleMarkdownChange(content);
        showToast(`Loaded ${file.name}`, 'success');
      };
      reader.readAsText(file);
    }
    // Reset file input value so same file can be selected again
    event.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        handleMarkdownChange(content);
        showToast(`Loaded ${file.name}`, 'success');
      };
      reader.readAsText(file);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Markdown copied to clipboard', 'info');
    } catch (err) {
      console.error('Failed to copy', err);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleClear = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Editor Content?',
      description: 'This will remove all text currently in the editor. This action cannot be undone.',
      confirmText: 'Clear All',
      variant: 'danger',
      action: () => {
        handleMarkdownChange('');
        setConfirmModal(null);
        showToast('Editor cleared', 'info');
      },
    });
  };

  const handleResetTemplate = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset to Sample Tutorial?',
      description: 'Your current edits will be replaced with the default tutorial document.',
      confirmText: 'Reset Document',
      variant: 'primary',
      action: () => {
        handleMarkdownChange(defaultMarkdown);
        setConfirmModal(null);
        showToast('Reset to sample tutorial', 'success');
      },
    });
  };

  const handleDownloadMarkdown = () => {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const suggestedName = titleMatch
      ? `${titleMatch[1].trim().replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_')}.md`
      : 'document.md';

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Markdown downloaded', 'success');
  };


  const handleFullscreen = () => {
    if (!isFullscreen && previewRef.current) {
      if (previewRef.current.requestFullscreen) {
        previewRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Hidden file input for markdown import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Modern App Header */}
      <header
        className={`px-6 py-3.5 border-b backdrop-blur-md transition-colors sticky top-0 z-20 ${
          isDark
            ? 'bg-slate-900/90 border-slate-800'
            : 'bg-white/90 border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                  MerkPDF
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Markdown Editor &bull; KaTeX &bull; Mermaid &bull; PDF Studio
              </p>
            </div>
          </div>

          {/* Actions & Tools */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className={`hidden sm:flex items-center p-0.5 rounded-lg border ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'split'
                    ? (isDark ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900')
                }`}
                title="Split View (Side by side)"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                onClick={() => setViewMode('editor')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'editor'
                    ? (isDark ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900')
                }`}
                title="Editor Only"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'preview'
                    ? (isDark ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900')
                }`}
                title="Preview Only"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            {/* Dark/Light Mode Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-200 border-slate-300'
              }`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              <span className="sr-only">Toggle theme</span>
              <Sun className="absolute left-1.5 w-3 h-3 text-amber-500/70" />
              <Moon className="absolute right-1.5 w-3 h-3 text-indigo-400/70" />
              <span
                className={`relative z-10 flex h-5.5 w-5.5 items-center justify-center rounded-full border transition-transform duration-200 ease-in-out shadow-xs ${
                  isDark
                    ? 'translate-x-6 bg-slate-900 border-slate-700 text-indigo-400'
                    : 'translate-x-0 bg-white border-slate-200 text-amber-500'
                }`}
              >
                {isDark ? (
                  <Moon className="w-3.5 h-3.5" />
                ) : (
                  <Sun className="w-3.5 h-3.5" />
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden p-3 sm:p-4">
        <div className={`h-full grid gap-4 ${
          viewMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1'
        }`}>
          {/* Editor Container */}
          {(viewMode === 'split' || viewMode === 'editor') && (
            <div
              className={`relative flex flex-col rounded-xl border shadow-xs overflow-hidden transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {/* Drag and drop overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-blue-600/10 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-xl pointer-events-none">
                  <UploadCloud className="w-12 h-12 text-blue-500 mb-2 animate-bounce" />
                  <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                    Drop Markdown file here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports .md, .markdown, .txt
                  </p>
                </div>
              )}

              {/* Editor Header Bar */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${
                isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/60'
              }`}>
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-blue-500" />
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Markdown Source
                  </span>
                  <span className={`hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${
                    isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    Raw text
                  </span>
                </div>

                {/* Editor File & Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md transition-all ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-sky-950/30 hover:border-sky-800/80 hover:text-sky-300'
                        : 'border-slate-200 text-slate-700 hover:bg-sky-50/80 hover:border-sky-200 hover:text-sky-700'
                    }`}
                    title="Import markdown file"
                  >
                    <FileUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className={`p-1.5 text-xs font-medium border rounded-md transition-all ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-blue-950/30 hover:border-blue-800/80 hover:text-blue-300'
                        : 'border-slate-200 text-slate-700 hover:bg-blue-50/80 hover:border-blue-200 hover:text-blue-700'
                    }`}
                    title="Save Markdown file (.md)"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md transition-all ${
                      copied
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-emerald-950/30 hover:border-emerald-800/80 hover:text-emerald-300'
                        : 'border-slate-200 text-slate-700 hover:bg-emerald-50/80 hover:border-emerald-200 hover:text-emerald-700'
                    }`}
                    title="Copy Markdown source to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleResetTemplate}
                    className={`p-1.5 text-xs font-medium border rounded-md transition-all ${
                      isDark
                        ? 'border-slate-700 text-slate-400 hover:bg-amber-950/30 hover:border-amber-800/80 hover:text-amber-300'
                        : 'border-slate-200 text-slate-500 hover:bg-amber-50/80 hover:border-amber-200 hover:text-amber-700'
                    }`}
                    title="Reset template"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </button>
                  <button
                    onClick={handleClear}
                    className={`p-1.5 text-xs font-medium border rounded-md transition-all ${
                      isDark
                        ? 'border-slate-700 text-slate-400 hover:bg-rose-950/30 hover:border-rose-800/80 hover:text-rose-300'
                        : 'border-slate-200 text-slate-500 hover:bg-rose-50/80 hover:border-rose-200 hover:text-rose-700'
                    }`}
                    title="Clear editor"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  </button>
                </div>
              </div>

              {/* Editor Textarea */}
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={markdown}
                  onChange={(e) => handleMarkdownChange(e.target.value)}
                  className={`w-full h-full p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-950 text-slate-200 placeholder-slate-600'
                      : 'bg-white text-slate-800 placeholder-slate-400'
                  }`}
                  placeholder="Type your markdown here or drop a .md file..."
                  spellCheck={false}
                />
              </div>

              {/* Editor Footer Status Bar */}
              <div className={`px-4 py-2 border-t flex items-center justify-between text-xs ${
                isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-slate-50/60 text-slate-500'
              }`}>
                <div className="flex items-center gap-3">
                  <span>Lines: {stats.lines}</span>
                  <span>Words: {stats.words}</span>
                  <span>Chars: {stats.chars}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview Container */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              ref={previewRef}
              className={`flex flex-col rounded-xl border shadow-xs overflow-hidden transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Preview Header Bar */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${
                isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/60'
              }`}>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Rendered Preview
                  </span>
                  <span className={`hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${
                    isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    Live GFM
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer select-none transition-colors ${
                      includePageNumbers
                        ? (isDark ? 'bg-blue-950/60 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')
                        : (isDark ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900')
                    }`}
                    title="Toggle page numbers in exported PDF"
                  >
                    <input
                      type="checkbox"
                      checked={includePageNumbers}
                      onChange={(e) => setIncludePageNumbers(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>Page Numbers</span>
                  </label>

                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md text-white transition-all ${
                      isExporting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
                    }`}
                    title="Export document as PDF"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Export PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleFullscreen}
                    className={`p-1.5 text-xs font-medium border rounded-md transition-all ${
                      isDark
                        ? 'border-slate-700 text-slate-400 hover:bg-indigo-950/30 hover:border-indigo-800/80 hover:text-indigo-300'
                        : 'border-slate-200 text-slate-500 hover:bg-indigo-50/80 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Content Area */}
              <div className="flex-1 overflow-auto">
                <MarkdownPreview markdown={markdown} theme={theme} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-app Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 transition-all scale-100 ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${
                confirmModal.variant === 'danger'
                  ? (isDark ? 'bg-red-950/60 text-red-400 border border-red-900/60' : 'bg-red-50 text-red-600 border border-red-200')
                  : (isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-900/60' : 'bg-blue-50 text-blue-600 border border-blue-200')
              }`}>
                {confirmModal.variant === 'danger' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-base font-bold tracking-tight">
                  {confirmModal.title}
                </h3>
                <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg text-white transition-all shadow-xs ${
                  confirmModal.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 active:scale-[0.98]'
                    : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'error'
              ? (isDark ? 'bg-red-950/90 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800')
              : toast.type === 'success'
              ? (isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
              : (isDark ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800')
          }`}
        >
          <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
