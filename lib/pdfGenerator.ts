export interface PDFExportOptions {
  includePageNumbers?: boolean;
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
    // Dynamically import jsPDF and html2canvas-pro (with full lab/oklch support)
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas-pro'),
    ]);

    // Extract document title from markdown heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const documentTitle = titleMatch ? titleMatch[1].trim() : 'Document';
    const cleanFileName = (
      documentTitle.replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '_') || 'document'
    ) + '.pdf';

    // Helper to escape HTML characters
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

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
      .merk-pdf-content ul, .merk-pdf-content ol {
        margin-top: 6px !important;
        margin-bottom: 6px !important;
        padding-left: 22px !important;
        color: #1e293b !important;
      }
      .merk-pdf-content li {
        margin-bottom: 3px !important;
        line-height: 1.55 !important;
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
        background-color: #fdf2f8 !important;
        color: #db2777 !important;
        border: 1px solid #fbcfe8 !important;
        padding: 1px 5px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-weight: 500 !important;
      }
      /* Code blocks */
      .merk-pdf-content pre {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        margin: 10px 0 !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-size: 12px !important;
        line-height: 1.45 !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
        border: 1px solid #334155 !important;
      }
      .merk-pdf-content pre code {
        background: transparent !important;
        padding: 0 !important;
        color: #f8fafc !important;
        border: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        letter-spacing: 0px !important;
      }
      /* Tables */
      .merk-pdf-content table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 10px 0 !important;
        font-size: 13px !important;
      }
      .merk-pdf-content th, .merk-pdf-content td {
        border: 1px solid #cbd5e1 !important;
        padding: 6px 10px !important;
        text-align: left !important;
        color: #1e293b !important;
      }
      .merk-pdf-content th {
        background-color: #f1f5f9 !important;
        font-weight: 700 !important;
        color: #0f172a !important;
      }
      /* Horizontal divider rule */
      .merk-pdf-content hr {
        border: none !important;
        border-top: 1px solid #e2e8f0 !important;
        margin: 14px 0 !important;
      }
      /* KaTeX MathML hiding fix: prevent raw MathML from creating huge white gaps */
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
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        padding: 10px !important;
        margin: 10px 0 !important;
      }
      .merk-pdf-content svg {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
    measuringContainer.appendChild(pdfStyles);
    document.body.appendChild(measuringContainer);

    // Wait for fonts to ensure pixel-perfect heights
    await document.fonts.ready;

    // 2. Clone children of preview for pagination
    const previewClone = previewElement.cloneNode(true) as HTMLElement;
    const clonedChildren = (Array.from(previewClone.children) as HTMLElement[]).map(el =>
      el.cloneNode(true) as HTMLElement
    );

    // Available height per A4 page (A4 = 1123px. Padding: 44px * 2 = 88px. Usable content = ~1035px)
    const PAGE_MAX_HEIGHT = includePageNumbers ? 1000 : 1030;

    const pages: HTMLElement[][] = [];
    let currentPageBlocks: HTMLElement[] = [];

    // Temporary element container inside measuring sandbox to measure accumulated height
    const testHost = document.createElement('div');
    measuringContainer.appendChild(testHost);

    for (let i = 0; i < clonedChildren.length; i++) {
      const block = clonedChildren[i];

      // Explicit manual page break check (only when explicitly requested via class or attribute, not standard HRs)
      const isManualBreak =
        block.getAttribute('data-pagebreak') === 'true' ||
        block.getAttribute('data-page-break') === 'true' ||
        block.classList.contains('page-break') ||
        block.classList.contains('pagebreak');

      if (isManualBreak) {
        if (currentPageBlocks.length > 0) {
          pages.push(currentPageBlocks);
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
        // If the last block on this page was a heading sitting at the very bottom (within 75px),
        // pull the heading onto the next page with this block so it is not stranded
        const lastBlock = currentPageBlocks[currentPageBlocks.length - 1];
        const isHeading = lastBlock && ['H1', 'H2', 'H3', 'H4'].includes(lastBlock.tagName);

        if (isHeading && currentPageBlocks.length > 1 && testHost.offsetHeight > PAGE_MAX_HEIGHT - 75) {
          currentPageBlocks.pop();
          testHost.removeChild(lastBlock);
          pages.push(currentPageBlocks);

          // Start new page with the heading + the current block
          currentPageBlocks = [lastBlock, block];
          testHost.innerHTML = '';
          testHost.appendChild(lastBlock);
          testHost.appendChild(block);
        } else {
          // Push current page
          pages.push(currentPageBlocks);

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
      pages.push(currentPageBlocks);
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
      pageWrapper.style.padding = includePageNumbers ? '40px 48px 24px 48px' : '44px 48px';
      pageWrapper.style.backgroundColor = '#ffffff';
      pageWrapper.style.color = '#0f172a';
      pageWrapper.style.display = 'flex';
      pageWrapper.style.flexDirection = 'column';
      pageWrapper.style.justifyContent = includePageNumbers ? 'space-between' : 'flex-start';
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

      // Optional unbranded page number footer
      if (includePageNumbers) {
        const footer = document.createElement('div');
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
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
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
