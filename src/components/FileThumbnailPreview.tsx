import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite asset URL import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Maximize2, FileText, Loader2, Image as ImageIcon, Compass } from 'lucide-react';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface FileThumbnailPreviewProps {
  url?: string;
  filename?: string;
  title?: string;
  category?: string;
  previewType?: string;
  className?: string;
  onExpand?: () => void;
  showExpandButton?: boolean;
}

export const FileThumbnailPreview: React.FC<FileThumbnailPreviewProps> = ({
  url,
  filename,
  title,
  category,
  previewType,
  className = '',
  onExpand,
  showExpandButton = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasRenderedPdf, setHasRenderedPdf] = useState<boolean>(false);
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);

  const cleanName = (filename || title || '').toLowerCase();
  const isPdf =
    Boolean(url?.startsWith('data:application/pdf')) ||
    Boolean(url?.includes('application/pdf')) ||
    cleanName.endsWith('.pdf') ||
    previewType === 'pdf_spec';

  const isImage =
    !isPdf &&
    (Boolean(url?.startsWith('data:image/')) ||
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanName) ||
      previewType === 'render_image');

  const isCad =
    /\.(dwg|dxf|cad|rvt|bim)$/i.test(cleanName) ||
    previewType === 'cad_file' ||
    category?.toLowerCase().includes('cad');

  // Render PDF Page 1 on canvas
  useEffect(() => {
    if (!isPdf || !url) {
      setHasRenderedPdf(false);
      return;
    }

    let isCancelled = false;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    setLoading(true);
    setHasRenderedPdf(false);

    const renderFirstPage = async () => {
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

        if (url.startsWith('data:')) {
          const parts = url.split(',');
          if (parts.length >= 2) {
            let base64 = parts[1];
            while (base64.length % 4 !== 0) {
              base64 += '=';
            }
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            loadingTask = pdfjsLib.getDocument({ data: bytes });
          } else {
            throw new Error('Invalid data URL');
          }
        } else {
          loadingTask = pdfjsLib.getDocument({ url });
        }

        pdfDoc = await loadingTask.promise;
        if (isCancelled) return;
        setPdfPageCount(pdfDoc.numPages);

        const page = await pdfDoc.getPage(1);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Base viewport to calculate scale
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        
        // Target preview dimension (e.g. 480px width or height)
        const targetWidth = containerRef.current?.clientWidth || 400;
        const scale = Math.max(0.4, Math.min(2.0, targetWidth / unscaledViewport.width));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvasContext: ctx,
          canvas,
          viewport,
        }).promise;

        if (!isCancelled) {
          setHasRenderedPdf(true);
          setLoading(false);
        }
      } catch (err) {
        console.warn('PDF thumbnail generation failed, falling back:', err);
        if (!isCancelled) {
          setHasRenderedPdf(false);
          setLoading(false);
        }
      }
    };

    renderFirstPage();

    return () => {
      isCancelled = true;
      if (pdfDoc) {
        try {
          // @ts-expect-error pdfjs typing
          if (typeof pdfDoc.destroy === 'function') {
            // @ts-expect-error pdfjs typing
            pdfDoc.destroy();
          }
        } catch {
          // ignore
        }
      }
    };
  }, [url, isPdf]);

  return (
    <div
      ref={containerRef}
      onClick={onExpand}
      className={`relative group bg-slate-950 rounded-xl overflow-hidden border border-slate-700/60 flex items-center justify-center cursor-pointer select-none transition shadow-inner ${className}`}
      title="Click to view full resolution"
    >
      {/* Background blueprint subtle pattern */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)',
          backgroundSize: '16px 16px'
        }}
      />

      {/* CASE 1: PDF Document with Canvas Thumbnail */}
      {isPdf && (
        <div className="relative w-full h-full flex items-center justify-center p-2 overflow-hidden bg-slate-900/90">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain rounded shadow-md bg-white transition duration-200 group-hover:scale-102 ${
              hasRenderedPdf ? 'block' : 'hidden'
            }`}
          />

          {loading && (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-[11px] font-mono text-slate-300">Rendering PDF Page 1...</span>
            </div>
          )}

          {!loading && !hasRenderedPdf && (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-200 truncate max-w-[200px]">
                  {filename || title || 'PDF Document'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {pdfPageCount > 0 ? `${pdfPageCount} Page PDF Document` : 'Click to view PDF document'}
                </p>
              </div>
            </div>
          )}

          {/* PDF Page 1 Tag */}
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-red-950/80 text-red-200 border border-red-800/80 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              PDF {pdfPageCount > 0 ? `• 1 of ${pdfPageCount}` : '• Page 1'}
            </span>
          </div>
        </div>
      )}

      {/* CASE 2: Image File */}
      {isImage && url && !imageError && (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
          <img
            src={url}
            alt={title || filename || 'Deliverable Image'}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain transition duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-blue-950/80 text-blue-200 border border-blue-800/80 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs">
              Image / Render
            </span>
          </div>
        </div>
      )}

      {/* CASE 3: CAD / DWG / Fallback */}
      {(!isPdf && (!isImage || imageError || !url)) && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
            {isCad ? <Compass className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div className="space-y-0.5 max-w-full px-2">
            <p className="text-xs font-bold text-slate-200 truncate" title={filename || title}>
              {filename || title || 'CAD Specification Sheet'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {category || (isCad ? 'CAD / DWG Drafting File' : 'Specification Document')}
            </p>
          </div>
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-slate-800/90 text-slate-300 border border-slate-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">
              {isCad ? 'CAD Asset' : 'Document'}
            </span>
          </div>
        </div>
      )}

      {/* Hover Overlay with Action Button */}
      {showExpandButton && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center gap-2 p-2 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
            }}
            className="bg-white/95 hover:bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-lg flex items-center gap-1.5 transform group-hover:translate-y-0 translate-y-1"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            <span>View Full Resolution</span>
          </button>
        </div>
      )}
    </div>
  );
};
