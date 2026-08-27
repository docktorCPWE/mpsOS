import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface GeneratedPDFResult {
  pdf: jsPDF;
  blob: Blob;
  dataUrl: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Renders any DOM element (e.g. #official-invoice-sheet) into a crisp, high-resolution PDF document.
 * Uses html2canvas-pro with a clean DOM staging harness to guarantee 100% of the invoice content is captured
 * without clipping from parent scroll containers or viewports.
 */
export async function generateInvoicePDF(
  elementId: string = 'official-invoice-sheet',
  customFilename?: string
): Promise<GeneratedPDFResult> {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) {
    throw new Error(`Invoice element with id "${elementId}" was not found in document.`);
  }

  // Create an offscreen staging container at (0,0) with zIndex -9999 to guarantee
  // valid positive coordinate layout and unconstrained height calculation
  const stagingContainer = document.createElement('div');
  stagingContainer.style.position = 'fixed';
  stagingContainer.style.top = '0';
  stagingContainer.style.left = '0';
  stagingContainer.style.width = '820px';
  stagingContainer.style.zIndex = '-99999';
  stagingContainer.style.opacity = '1';
  stagingContainer.style.pointerEvents = 'none';
  stagingContainer.style.background = '#ffffff';
  stagingContainer.style.margin = '0';
  stagingContainer.style.padding = '0';

  const clonedElement = originalElement.cloneNode(true) as HTMLElement;
  clonedElement.id = `${elementId}-pdf-render-staging`;
  clonedElement.style.width = '820px';
  clonedElement.style.minWidth = '820px';
  clonedElement.style.maxWidth = '820px';
  clonedElement.style.height = 'auto';
  clonedElement.style.minHeight = 'auto';
  clonedElement.style.maxHeight = 'none';
  clonedElement.style.overflow = 'visible';
  clonedElement.style.transform = 'none';
  clonedElement.style.boxShadow = 'none';
  clonedElement.style.border = 'none';
  clonedElement.style.borderRadius = '0';
  clonedElement.style.margin = '0';
  clonedElement.style.padding = '24px';
  clonedElement.style.backgroundColor = '#ffffff';

  stagingContainer.appendChild(clonedElement);
  document.body.appendChild(stagingContainer);

  let canvas: HTMLCanvasElement;

  try {
    // Brief frame wait to ensure fonts and layout dimensions calculate accurately
    await new Promise((resolve) => setTimeout(resolve, 60));

    const totalHeight = Math.max(
      clonedElement.scrollHeight,
      clonedElement.offsetHeight,
      clonedElement.getBoundingClientRect().height,
      900
    );

    canvas = await html2canvas(clonedElement, {
      scale: 2, // High-resolution retina crispness
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      width: 820,
      height: totalHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
      windowHeight: totalHeight + 100,
    });
  } finally {
    // Always clean up staging DOM
    if (document.body.contains(stagingContainer)) {
      document.body.removeChild(stagingContainer);
    }
  }

  // Standard US Letter in points: 612 x 792 pt
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 18; // 18pt margin
  const printableWidth = pageWidth - margin * 2; // 576 pt
  const printableHeight = pageHeight - margin * 2; // 756 pt

  const renderWidth = printableWidth;
  const renderHeight = (canvas.height * renderWidth) / canvas.width;

  if (renderHeight <= printableHeight * 1.18) {
    // Fits gracefully onto a single standard US Letter sheet
    const scale = Math.min(1, printableHeight / renderHeight);
    const finalWidth = renderWidth * scale;
    const finalHeight = renderHeight * scale;
    const offsetX = margin + (printableWidth - finalWidth) / 2;
    const offsetY = margin + (printableHeight - finalHeight) / 2;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, finalWidth, finalHeight);
  } else {
    // Multi-page document: Slice the canvas into crisp page-height sections
    const pxPageHeight = Math.floor((printableHeight / renderWidth) * canvas.width);
    const totalPages = Math.ceil(canvas.height / pxPageHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const srcY = page * pxPageHeight;
      const srcHeight = Math.min(pxPageHeight, canvas.height - srcY);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = srcHeight;
      const sliceCtx = sliceCanvas.getContext('2d');
      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0, srcY, canvas.width, srcHeight,
          0, 0, sliceCanvas.width, srcHeight
        );
        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.98);
        const sliceRenderHeight = (srcHeight * renderWidth) / canvas.width;
        pdf.addImage(sliceImgData, 'JPEG', margin, margin, renderWidth, sliceRenderHeight);
      }
    }
  }

  const filename = customFilename || `Invoice_${Date.now()}.pdf`;
  const blob = pdf.output('blob');
  const dataUrl = pdf.output('dataurlstring');
  const sizeBytes = blob.size;

  return {
    pdf,
    blob,
    dataUrl,
    filename,
    sizeBytes
  };
}

/**
 * Triggers an instant client-side download of a Blob file
 */
export function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

