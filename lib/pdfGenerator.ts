export async function generatePDF(markdown: string, fileHandle?: any) {
  const previewElement = document.getElementById('markdown-preview');
  if (!previewElement) {
    throw new Error('Preview element not found');
  }

  try {
    // Dynamically import jsPDF and html2canvas
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);

    // Clone the preview element
    const clonedElement = previewElement.cloneNode(true) as HTMLElement;

    // Prepare element for PDF - strip all classes to avoid Tailwind issues
    clonedElement.className = '';
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.top = '0';
    clonedElement.style.width = '794px'; // A4 width at 96 DPI
    clonedElement.style.maxWidth = '794px';
    clonedElement.style.padding = '40px';
    clonedElement.style.backgroundColor = '#ffffff';
    clonedElement.style.color = '#000000';
    clonedElement.style.fontSize = '16px';
    clonedElement.style.lineHeight = '1.6';
    clonedElement.style.fontFamily = 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

    // Strip problematic classes and force simple colors
    const allElements = clonedElement.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as HTMLElement;

      // Preserve SVG elements and internal SVG styling for diagrams
      if (element.tagName.toLowerCase() === 'svg' || element.closest('svg')) {
        return;
      }

      // Handle mermaid diagram container
      if (element.getAttribute('data-mermaid-container') === 'true') {
        element.className = '';
        element.style.display = 'flex';
        element.style.justifyContent = 'center';
        element.style.alignItems = 'center';
        element.style.backgroundColor = '#f8fafc';
        element.style.border = '1px solid #e2e8f0';
        element.style.borderRadius = '12px';
        element.style.padding = '20px';
        element.style.marginTop = '16px';
        element.style.marginBottom = '16px';
        return;
      }

      // Remove all classes that might have LAB colors
      element.className = '';

      // Force explicit colors
      if (element.tagName === 'A') {
        element.style.color = '#14b8a6'; // Teal
        element.style.textDecoration = 'underline';
      } else if (element.tagName === 'H1') {
        element.style.fontSize = '32px';
        element.style.fontWeight = '700';
        element.style.marginTop = '24px';
        element.style.marginBottom = '16px';
        element.style.color = '#000000';
      } else if (element.tagName === 'H2') {
        element.style.fontSize = '24px';
        element.style.fontWeight = '700';
        element.style.marginTop = '20px';
        element.style.marginBottom = '12px';
        element.style.color = '#000000';
      } else if (element.tagName === 'H3') {
        element.style.fontSize = '20px';
        element.style.fontWeight = '600';
        element.style.marginTop = '16px';
        element.style.marginBottom = '8px';
        element.style.color = '#000000';
      } else if (element.tagName === 'P') {
        element.style.marginTop = '12px';
        element.style.marginBottom = '12px';
        element.style.color = '#000000';
      } else if (element.tagName === 'CODE' && element.parentElement?.tagName !== 'PRE') {
        element.style.backgroundColor = '#f3f4f6';
        element.style.color = '#1f2937';
        element.style.padding = '2px 6px';
        element.style.borderRadius = '3px';
        element.style.fontSize = '14px';
        element.style.fontFamily = 'monospace';
      } else if (element.tagName === 'CODE' && element.parentElement?.tagName === 'PRE') {
        element.style.backgroundColor = 'transparent';
        element.style.padding = '0';
      } else if (element.tagName === 'PRE') {
        element.style.backgroundColor = '#1f2937';
        element.style.color = '#f3f4f6';
        element.style.padding = '16px';
        element.style.borderRadius = '8px';
        element.style.overflow = 'auto';
        element.style.marginTop = '12px';
        element.style.marginBottom = '12px';
      } else if (['UL', 'OL'].includes(element.tagName)) {
        element.style.marginLeft = '24px';
        element.style.marginTop = '12px';
        element.style.marginBottom = '12px';
      } else if (element.tagName === 'LI') {
        element.style.marginBottom = '4px';
        element.style.color = '#000000';
      } else if (element.tagName === 'TABLE') {
        element.style.borderCollapse = 'collapse';
        element.style.width = '100%';
        element.style.marginTop = '16px';
        element.style.marginBottom = '16px';
      } else if (['TH', 'TD'].includes(element.tagName)) {
        element.style.border = '1px solid #d1d5db';
        element.style.padding = '8px';
        element.style.color = '#000000';
      } else if (element.tagName === 'TH') {
        element.style.backgroundColor = '#f3f4f6';
        element.style.fontWeight = '600';
      }
    });

    // Append to body for rendering
    document.body.appendChild(clonedElement);

    // Wait for rendering
    await new Promise(resolve => setTimeout(resolve, 300));

    // Create canvas from HTML with improved settings
    const canvas = await html2canvas(clonedElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
      onclone: (clonedDoc) => {
        // Ensure no LAB colors in cloned document
        const clonedRoot = clonedDoc.getElementById(clonedElement.id);
        if (clonedRoot) {
          clonedRoot.style.backgroundColor = '#ffffff';
        }
      }
    });

    // Remove cloned element
    document.body.removeChild(clonedElement);

    // Create PDF
    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const fileName = titleMatch
      ? `${titleMatch[1].trim().replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_')}.pdf`
      : 'document.pdf';

    // If caller already got a FileSystemFileHandle from the user
    if (fileHandle) {
      const pdfBlob = pdf.output('blob');
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return;
    }

    // If File System Access API is supported and no handle was pre-passed
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PDF Document (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
        const pdfBlob = pdf.output('blob');
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User clicked Cancel in the save dialog
          return;
        }
        console.warn('File picker error, falling back:', err);
      }
    }

    // Fallback for browsers without File System Access API
    pdf.save(fileName);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}
