import { isAsciiDiagram } from './diagramUtils';

export interface PDFExportOptions {
  includePageNumbers?: boolean;
}

/**
 * Sanitizes cloned DOM elements for clean, publication-ready print output.
 * Strips all dark mode classes, dark background/text overrides, and interactive buttons,
 * ensuring high-contrast typography and clean light tables on white paper.
 */
function sanitizeForPrint(root: HTMLElement): void {
  // Strip buttons and non-printable elements
  root.querySelectorAll('button').forEach(btn => btn.remove());
  root.querySelectorAll('[data-no-print="true"]').forEach(el => el.remove());

  const allElements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const el of allElements) {
    // 1. Strip all dark-variant and theme classes (e.g. dark:text-slate-100, dark:bg-slate-900, prose-invert)
    const darkClasses = Array.from(el.classList).filter(
      c => c.startsWith('dark:') || c.includes('dark') || c === 'prose-invert'
    );
    for (const c of darkClasses) {
      el.classList.remove(c);
    }

    // 2. Remove inline color & background styles so print stylesheet has full authority
    if (el.style) {
      el.style.removeProperty('color');
      el.style.removeProperty('background');
      el.style.removeProperty('background-color');
    }
  }
}

export async function generatePDF(markdown: string, options: PDFExportOptions = {}) {
  const { includePageNumbers = false } = options;

  const previewElement = document.getElementById('markdown-preview');
  if (!previewElement) {
    throw new Error('Preview element not found');
  }

  // Tracking temporary containers for guaranteed cleanup in finally block
  let measuringContainer: HTMLElement | null = null;
  let renderContainer: HTMLElement | null = null;

  try {
    // Dynamically import jsPDF, html2canvas-pro, and mermaid
    const [{ default: jsPDF }, { default: html2canvas }, { default: mermaid }] = await Promise.all([
      import('jspdf'),
      import('html2canvas-pro'),
      import('mermaid'),
    ]);

    // Extract document title from markdown heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const documentTitle = titleMatch ? titleMatch[1].trim() : 'Document';
    const cleanFileName = (
      documentTitle.replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '_') || 'document'
    ) + '.pdf';

    // 1. Setup measuring container offscreen with identical printable width (698px)
    measuringContainer = document.createElement('div');
    measuringContainer.id = 'pdf-measuring-sandbox';
    measuringContainer.className = 'merk-pdf-content';
    measuringContainer.style.position = 'fixed';
    measuringContainer.style.left = '0';
    measuringContainer.style.top = '0';
    measuringContainer.style.width = '698px';
    measuringContainer.style.maxWidth = '698px';
    measuringContainer.style.zIndex = '-99999';
    measuringContainer.style.opacity = '0';
    measuringContainer.style.pointerEvents = 'none';

    // Dedicated print stylesheet for crisp layout and accurate typography
    const pdfStyles = document.createElement('style');
    pdfStyles.innerHTML = `
      .merk-pdf-content {
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        color: #0f172a !important;
        background-color: #ffffff !important;
        line-height: 1.6 !important;
        font-size: 14px !important;
        word-wrap: break-word !important;
      }
      .merk-pdf-content button {
        display: none !important;
      }
      .merk-pdf-content h1 {
        font-size: 24px !important;
        font-weight: 800 !important;
        color: #0f172a !important;
        margin-top: 16px !important;
        margin-bottom: 10px !important;
        line-height: 1.25 !important;
      }
      .merk-pdf-content h2 {
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #0f172a !important;
        margin-top: 14px !important;
        margin-bottom: 8px !important;
        line-height: 1.3 !important;
      }
      .merk-pdf-content h3 {
        font-size: 15.5px !important;
        font-weight: 700 !important;
        color: #0f172a !important;
        margin-top: 12px !important;
        margin-bottom: 6px !important;
        line-height: 1.35 !important;
      }
      .merk-pdf-content h4 {
        font-size: 14px !important;
        font-weight: 600 !important;
        color: #1e293b !important;
        margin-top: 10px !important;
        margin-bottom: 4px !important;
      }
      .merk-pdf-content p {
        margin-top: 7px !important;
        margin-bottom: 7px !important;
        color: #1e293b !important;
        line-height: 1.6 !important;
      }
      .merk-pdf-content strong, .merk-pdf-content b {
        color: #0f172a !important;
        font-weight: 700 !important;
      }
      .merk-pdf-content em, .merk-pdf-content i {
        font-style: italic !important;
      }
      .merk-pdf-content ul, .merk-pdf-content ol {
        margin-top: 6px !important;
        margin-bottom: 6px !important;
        padding-left: 22px !important;
        color: #1e293b !important;
      }
      .merk-pdf-content li {
        margin-bottom: 4px !important;
        line-height: 1.55 !important;
        color: #1e293b !important;
      }
      .merk-pdf-content li::marker {
        color: #475569 !important;
      }
      .merk-pdf-content li p,
      .merk-pdf-content li span {
        color: #1e293b !important;
      }
      .merk-pdf-content li strong,
      .merk-pdf-content li b {
        color: #0f172a !important;
        font-weight: 700 !important;
      }
      .merk-pdf-content blockquote {
        border-left: 4px solid #3b82f6 !important;
        padding: 6px 14px !important;
        margin: 10px 0 !important;
        color: #475569 !important;
        background: #f8fafc !important;
        border-radius: 0 6px 6px 0 !important;
      }
      /* Fallback for inline code badges */
      .merk-pdf-content :not(pre) > code {
        background-color: rgba(175, 184, 193, 0.2) !important;
        color: #24292f !important;
        border: 1px solid rgba(175, 184, 193, 0.4) !important;
        padding: 1px 5px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-weight: 500 !important;
      }
      /* GitHub Light Editorial Code blocks */
      .merk-pdf-content .code-snippet-wrapper {
        margin: 12px 0 !important;
        border: 1px solid #d0d7de !important;
        border-radius: 6px !important;
        overflow: hidden !important;
        background-color: #f6f8fa !important;
        box-shadow: none !important;
      }
      .merk-pdf-content .code-snippet-header,
      .merk-pdf-content [data-code-header="true"] {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 5px 12px !important;
        background-color: #f6f8fa !important;
        color: #57606a !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        border-bottom: 1px solid #d0d7de !important;
      }
      .merk-pdf-content .code-snippet-header button,
      .merk-pdf-content button {
        display: none !important;
      }
      .merk-pdf-content pre {
        background-color: #f6f8fa !important;
        color: #24292f !important;
        padding: 10px 14px !important;
        border-radius: 0 !important;
        margin: 0 !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-size: 11.5px !important;
        line-height: 1.55 !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        tab-size: 4 !important;
        border: none !important;
      }
      .merk-pdf-content pre.ascii-diagram,
      .merk-pdf-content .is-ascii-diagram pre,
      .merk-pdf-content [data-ascii-diagram="true"] pre {
        line-height: 1.2 !important;
        white-space: pre !important;
        font-size: 11px !important;
        letter-spacing: 0px !important;
        font-variant-east-asian: normal !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .merk-pdf-content pre code {
        background: transparent !important;
        padding: 0 !important;
        color: #24292f !important;
        border: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        letter-spacing: 0px !important;
      }
      /* GitHub Light Editorial Syntax Highlighting for PDF */
      .merk-pdf-content .hljs-keyword,
      .merk-pdf-content .hljs-selector-tag,
      .merk-pdf-content .hljs-subst { color: #cf222e !important; font-weight: 600 !important; }
      .merk-pdf-content .hljs-string { color: #0a3069 !important; }
      .merk-pdf-content .hljs-title,
      .merk-pdf-content .hljs-section,
      .merk-pdf-content .hljs-attribute,
      .merk-pdf-content .hljs-literal { color: #0550ae !important; }
      .merk-pdf-content .hljs-comment,
      .merk-pdf-content .hljs-quote,
      .merk-pdf-content .hljs-meta { color: #6e7781 !important; font-style: italic !important; }
      .merk-pdf-content .hljs-number,
      .merk-pdf-content .hljs-regexp { color: #0550ae !important; }
      .merk-pdf-content .hljs-function,
      .merk-pdf-content .hljs-title.function_ { color: #8250df !important; font-weight: 600 !important; }
      .merk-pdf-content .hljs-attr,
      .merk-pdf-content .hljs-variable,
      .merk-pdf-content .hljs-params { color: #953800 !important; }
      .merk-pdf-content .hljs-type,
      .merk-pdf-content .hljs-class .hljs-title { color: #953800 !important; font-weight: 600 !important; }
      .merk-pdf-content .hljs-built_in { color: #0550ae !important; }
      .merk-pdf-content .hljs-tag { color: #116329 !important; }
      .merk-pdf-content .hljs-name { color: #116329 !important; font-weight: 600 !important; }
      .merk-pdf-content .hljs-property { color: #0550ae !important; }
      .merk-pdf-content .hljs-punctuation { color: #57606a !important; }
      /* Tables */
      .merk-pdf-content table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 12px 0 !important;
        font-size: 12.5px !important;
        background-color: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
      }
      .merk-pdf-content thead {
        background-color: #f1f5f9 !important;
      }
      .merk-pdf-content tbody {
        background-color: #ffffff !important;
      }
      .merk-pdf-content tr {
        background-color: #ffffff !important;
        border-bottom: 1px solid #e2e8f0 !important;
      }
      .merk-pdf-content tbody tr:nth-child(even) {
        background-color: #f8fafc !important;
      }
      .merk-pdf-content th {
        background-color: #f1f5f9 !important;
        font-weight: 700 !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        padding: 7px 10px !important;
        text-align: left !important;
      }
      .merk-pdf-content td {
        background-color: transparent !important;
        color: #1e293b !important;
        border: 1px solid #cbd5e1 !important;
        padding: 7px 10px !important;
      }
      /* Horizontal divider rule */
      .merk-pdf-content hr {
        border: none !important;
        border-top: 1px solid #e2e8f0 !important;
        margin: 14px 0 !important;
      }
      /* KaTeX MathML hiding fix */
      .merk-pdf-content .katex-mathml {
        display: none !important;
        clip: rect(1px, 1px, 1px, 1px) !important;
        height: 0px !important;
        width: 0px !important;
        overflow: hidden !important;
        position: absolute !important;
      }
      .merk-pdf-content .katex-html {
        display: inline-block !important;
        color: #0f172a !important;
      }
      .merk-pdf-content .katex {
        font-size: 1.05em !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
      }
      /* Mermaid Diagram container */
      .merk-pdf-content [data-mermaid-container="true"],
      .merk-pdf-content .mermaid-diagram {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        padding: 10px !important;
        margin: 10px 0 !important;
      }
      .merk-pdf-content img,
      .merk-pdf-content svg,
      .merk-pdf-content [data-mermaid-container="true"] {
        max-height: 850px !important;
        max-width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
      }
    `;
    measuringContainer.appendChild(pdfStyles);
    document.body.appendChild(measuringContainer);

    // Wait for fonts to ensure pixel-perfect heights
    await document.fonts.ready;

    // 2. Clone preview for pagination and re-render Mermaid diagrams
    const previewClone = previewElement.cloneNode(true) as HTMLElement;
    sanitizeForPrint(previewClone);

    // Tag and format all ASCII diagrams in previewClone for seamless rendering
    previewClone.querySelectorAll<HTMLElement>('.code-snippet-wrapper').forEach((wrapper) => {
      const preEl = wrapper.querySelector('pre');
      const text = preEl?.textContent || '';
      if (wrapper.getAttribute('data-ascii-diagram') === 'true' || isAsciiDiagram(text)) {
        wrapper.classList.add('is-ascii-diagram');
        wrapper.setAttribute('data-ascii-diagram', 'true');
        if (preEl) preEl.classList.add('ascii-diagram');
        const headerSpan = wrapper.querySelector('[data-code-header="true"] span');
        if (headerSpan && (!headerSpan.textContent || headerSpan.textContent.trim().toUpperCase() === 'CODE')) {
          headerSpan.textContent = 'DIAGRAM';
        }
      }
    });

    const diagrams = Array.from(previewClone.querySelectorAll<HTMLElement>('.mermaid-diagram'));
    if (previewClone.classList.contains('mermaid-diagram')) {
      diagrams.unshift(previewClone);
    }
    for (const d of diagrams) {
      const code = d.getAttribute('data-code');
      if (code) {
        try {
          const renderId = `pdf-mermaid-${Math.random().toString(36).substring(2, 8)}`;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
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
              fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
          });
          const { svg } = await mermaid.render(renderId, code);
          d.innerHTML = svg;
        } catch {}
      }
    }

    // Available usable height per A4 page (A4 total = 1123px. Padding: 40/44px * 2 + footer = ~94px. Usable content = ~1000-1030px)
    const PAGE_MAX_HEIGHT = includePageNumbers ? 1000 : 1030;

    /**
     * Decomposes container elements into printable atomic units to prevent
     * monolithic lists or tables from overflowing and getting chopped at page boundaries.
     */
    function decomposeNode(el: HTMLElement): HTMLElement[] {
      // Decompose ordered and unordered lists
      if (el.tagName === 'OL' || el.tagName === 'UL') {
        const isOL = el.tagName === 'OL';
        const items = Array.from(el.children).filter(c => c.tagName === 'LI') as HTMLElement[];
        if (items.length > 1) {
          const parsedStart = parseInt(el.getAttribute('start') || '1', 10);
          const baseStart = isNaN(parsedStart) ? 1 : parsedStart;
          return items.map((li, idx) => {
            const wrapper = document.createElement(isOL ? 'ol' : 'ul');
            wrapper.className = el.className;
            if (isOL) {
              wrapper.setAttribute('start', String(baseStart + idx));
            }
            wrapper.appendChild(li.cloneNode(true));
            return wrapper;
          });
        }
      }

      // Decompose large tables with many rows (> 7 rows)
      const table = el.tagName === 'TABLE' ? (el as HTMLTableElement) : el.querySelector('table');
      if (table) {
        const tbody = table.querySelector('tbody');
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        if (rows.length > 7) {
          const chunks: HTMLElement[] = [];
          const thead = table.querySelector('thead');
          const chunkSize = 6;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const tableClone = table.cloneNode(false) as HTMLTableElement;
            tableClone.className = table.className;
            if (thead) tableClone.appendChild(thead.cloneNode(true));
            const newTbody = document.createElement('tbody');
            if (tbody) newTbody.className = tbody.className;
            for (let j = i; j < Math.min(i + chunkSize, rows.length); j++) {
              newTbody.appendChild(rows[j].cloneNode(true));
            }
            tableClone.appendChild(newTbody);
            const divWrapper = document.createElement('div');
            divWrapper.className = el.tagName === 'DIV' ? el.className : 'overflow-x-auto my-4';
            divWrapper.appendChild(tableClone);
            chunks.push(divWrapper);
          }
          return chunks;
        }
      }

      // Decompose long code blocks (> 25 lines) to maintain optimal vertical rhythm
      const pre = el.querySelector('pre');
      if (pre && el.classList.contains('code-snippet-wrapper')) {
        // Never split ASCII/box diagrams across pages
        const code = pre.querySelector('code');
        const text = code?.textContent || '';
        if (
          el.getAttribute('data-ascii-diagram') === 'true' ||
          el.classList.contains('is-ascii-diagram') ||
          pre.classList.contains('ascii-diagram') ||
          isAsciiDiagram(text)
        ) {
          return [el.cloneNode(true) as HTMLElement];
        }
        const lines = text.split('\n');
        if (lines.length > 25) {
          const chunks: HTMLElement[] = [];
          const chunkSize = 20;
          const langHeader = el.querySelector('[data-code-header="true"]');
          const langText = langHeader?.querySelector('span')?.textContent?.trim() || 'CODE';

          for (let i = 0; i < lines.length; i += chunkSize) {
            const chunkLines = lines.slice(i, i + chunkSize).join('\n');
            const chunkWrapper = el.cloneNode(false) as HTMLElement;
            chunkWrapper.className = el.className;

            const headerClone = document.createElement('div');
            headerClone.setAttribute('data-code-header', 'true');
            headerClone.className = langHeader?.className || 'code-snippet-header';
            const span = document.createElement('span');
            span.textContent = i === 0 ? langText : `${langText} (CONT.)`;
            headerClone.appendChild(span);
            chunkWrapper.appendChild(headerClone);

            const newPre = pre.cloneNode(false) as HTMLElement;
            const newCode = document.createElement('code');
            newCode.className = code?.className || '';
            newCode.textContent = chunkLines;
            newPre.appendChild(newCode);
            chunkWrapper.appendChild(newPre);

            chunks.push(chunkWrapper);
          }
          return chunks;
        }
      }

      return [el.cloneNode(true) as HTMLElement];
    }

    /**
     * Merges adjacent list items of the same list type on the same page
     * to preserve natural margin collapse and vertical rhythm.
     */
    function mergeAdjacentLists(blocks: HTMLElement[]): HTMLElement[] {
      const merged: HTMLElement[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const current = blocks[i];
        const prev = merged[merged.length - 1];

        if (
          prev &&
          prev.tagName === current.tagName &&
          (current.tagName === 'OL' || current.tagName === 'UL') &&
          prev.className === current.className
        ) {
          const currentItems = Array.from(current.children);
          currentItems.forEach(li => prev.appendChild(li));
          continue;
        }
        merged.push(current);
      }
      return merged;
    }

    // Flatten raw preview children into splittable printable blocks
    const rawClonedChildren = Array.from(previewClone.children) as HTMLElement[];
    const flattenedBlocks: HTMLElement[] = [];
    for (const child of rawClonedChildren) {
      flattenedBlocks.push(...decomposeNode(child));
    }

    const pages: HTMLElement[][] = [];
    let currentPageBlocks: HTMLElement[] = [];

    // Temporary element container inside measuring sandbox to measure accumulated height
    const testHost = document.createElement('div');
    measuringContainer.appendChild(testHost);

    for (let i = 0; i < flattenedBlocks.length; i++) {
      const block = flattenedBlocks[i];

      // Explicit manual page break check
      const isManualBreak =
        block.getAttribute('data-pagebreak') === 'true' ||
        block.getAttribute('data-page-break') === 'true' ||
        block.classList.contains('page-break') ||
        block.classList.contains('pagebreak');

      if (isManualBreak) {
        if (currentPageBlocks.length > 0) {
          pages.push(mergeAdjacentLists(currentPageBlocks));
          currentPageBlocks = [];
          testHost.innerHTML = '';
        }
        continue;
      }

      // Add to measuring host to see rendered cumulative height including margin collapse
      testHost.appendChild(block);
      const measuredHeight = testHost.offsetHeight;

      // If adding this block overflows the page:
      if (measuredHeight > PAGE_MAX_HEIGHT && testHost.children.length > 1) {
        testHost.removeChild(block);

        // Orphan heading protection:
        // If the last block on this page was a heading sitting at the very bottom,
        // pull the heading onto the next page with this block so it is not stranded
        const lastBlock = currentPageBlocks[currentPageBlocks.length - 1];
        const isHeading = lastBlock && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(lastBlock.tagName);

        if (isHeading && currentPageBlocks.length > 1) {
          currentPageBlocks.pop();
          testHost.removeChild(lastBlock);
          pages.push(mergeAdjacentLists(currentPageBlocks));

          // Start new page with the heading + the current block
          currentPageBlocks = [lastBlock, block];
          testHost.innerHTML = '';
          testHost.appendChild(lastBlock);
          testHost.appendChild(block);
        } else {
          // Push current page
          pages.push(mergeAdjacentLists(currentPageBlocks));

          // Start new page with this block
          currentPageBlocks = [block];
          testHost.innerHTML = '';
          testHost.appendChild(block);
        }
      } else {
        currentPageBlocks.push(block);
      }
    }

    if (currentPageBlocks.length > 0) {
      pages.push(mergeAdjacentLists(currentPageBlocks));
    }

    const totalPages = Math.max(1, pages.length);

    // 3. Construct clean A4 page DOM nodes for rendering
    renderContainer = document.createElement('div');
    renderContainer.id = 'pdf-pages-render-container';
    renderContainer.style.position = 'fixed';
    renderContainer.style.left = '0';
    renderContainer.style.top = '0';
    renderContainer.style.zIndex = '-99999';
    renderContainer.style.opacity = '0';
    renderContainer.style.pointerEvents = 'none';
    renderContainer.appendChild(pdfStyles.cloneNode(true));

    const pageWrappers: HTMLElement[] = [];

    pages.forEach((pageBlocks, pageIndex) => {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'merk-pdf-page';
      pageWrapper.style.width = '794px';
      pageWrapper.style.height = '1123px';
      pageWrapper.style.minHeight = '1123px';
      pageWrapper.style.maxHeight = '1123px';
      pageWrapper.style.boxSizing = 'border-box';
      pageWrapper.style.padding = includePageNumbers ? '40px 48px 36px 48px' : '44px 48px';
      pageWrapper.style.backgroundColor = '#ffffff';
      pageWrapper.style.color = '#0f172a';
      pageWrapper.style.display = 'flex';
      pageWrapper.style.flexDirection = 'column';
      pageWrapper.style.justifyContent = 'flex-start';
      pageWrapper.style.position = 'relative';
      pageWrapper.style.overflow = 'hidden';

      // Page Content
      const content = document.createElement('div');
      content.className = 'merk-pdf-content';
      content.style.width = '100%';

      pageBlocks.forEach(b => {
        content.appendChild(b.cloneNode(true));
      });
      pageWrapper.appendChild(content);

      // Optional page number footer
      if (includePageNumbers) {
        const footer = document.createElement('div');
        footer.style.position = 'absolute';
        footer.style.bottom = '18px';
        footer.style.right = '48px';
        footer.style.height = '18px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.alignItems = 'center';
        footer.style.fontSize = '10.5px';
        footer.style.color = '#94a3b8';
        footer.style.fontFamily = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        footer.innerHTML = `<span style="font-weight: 500;">Page ${pageIndex + 1} of ${totalPages}</span>`;
        pageWrapper.appendChild(footer);
      }

      renderContainer!.appendChild(pageWrapper);
      pageWrappers.push(pageWrapper);
    });

    document.body.appendChild(renderContainer);

    // Wait for DOM to stabilize
    await new Promise(resolve => setTimeout(resolve, 150));

    // 4. Render each A4 page into jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pageWrappers.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const canvas = await html2canvas(pageWrappers[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // 5. Save PDF download
    pdf.save(cleanFileName);
  } finally {
    // 6. Guarantee cleanup of temporary DOM nodes
    if (measuringContainer && measuringContainer.parentNode) {
      measuringContainer.parentNode.removeChild(measuringContainer);
    }
    if (renderContainer && renderContainer.parentNode) {
      renderContainer.parentNode.removeChild(renderContainer);
    }
  }
}
