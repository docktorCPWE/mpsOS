import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite asset URL import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, Maximize2, RotateCw, AlertCircle, Loader2 } from 'lucide-react';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface PdfCanvasViewerProps {
  url: string;
  filename?: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ url, filename }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

        if (url.startsWith('data:')) {
          // Extract base64 and convert to Uint8Array
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

        const doc = await loadingTask.promise;
        if (isCancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('PDF.js loading failed:', err);
        setError(err.message || 'Unable to render PDF canvas');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url]);

  // Render pages onto canvases
  useEffect(() => {
    if (!pdfDocRef.current || loading || error) return;
    let isCancelled = false;

    const renderPages = async () => {
      const doc = pdfDocRef.current;
      if (!doc) return;

      const pagesToRender = viewMode === 'single' ? [currentPage] : Array.from({ length: doc.numPages }, (_, i) => i + 1);

      for (const pageNum of pagesToRender) {
        if (isCancelled) break;
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) continue;

        try {
          const page = await doc.getPage(pageNum);
          if (isCancelled) break;

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: scale * dpr, rotation });
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvasContext: ctx,
            viewport
          }).promise;
        } catch (renderErr) {
          console.warn(`Error rendering page ${pageNum}:`, renderErr);
        }
      }
    };

    renderPages();

    return () => {
      isCancelled = true;
    };
  }, [scale, rotation, currentPage, viewMode, loading, error]);

  const handleZoomIn = () => setScale(prev => Math.min(3.0, prev + 0.2));
  const handleZoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));
  const handleZoomReset = () => setScale(1.0);
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white rounded-xl overflow-hidden">
      {/* Viewer Floating Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-300 w-12 text-center text-[11px]">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer"
            title="Actual Size (100%)"
          >
            100%
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer ml-1"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page navigation controls */}
        {numPages > 1 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                  viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Pages ({numPages})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                  viewMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Page by Page
              </button>
            </div>

            {viewMode === 'single' && (
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                >
                  ◀
                </button>
                <span>{currentPage} / {numPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  className="px-2 py-0.5 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start bg-slate-950/90 min-h-[400px]">
        {loading && (
          <div className="my-auto flex flex-col items-center gap-3 text-slate-400 py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs font-medium">Rendering PDF Plan Sheets...</p>
          </div>
        )}

        {error && (
          <div className="my-auto max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Browser Canvas Render Notice</h4>
            <p className="text-xs text-slate-400">
              The PDF document structure can also be viewed in a native browser tab or downloaded directly:
            </p>
            <div className="pt-2">
              <iframe
                src={url}
                title={filename || 'PDF Document'}
                className="w-full h-80 rounded border border-slate-700 bg-white"
              />
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col items-center gap-6 py-2">
            {viewMode === 'all' ? (
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} className="flex flex-col items-center gap-1.5 shadow-2xl">
                  {numPages > 1 && (
                    <span className="text-[10px] font-mono text-slate-400 self-start bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Sheet / Page {pageNum} of {numPages}
                    </span>
                  )}
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[pageNum] = el;
                    }}
                    className="rounded-lg shadow-2xl bg-white border border-slate-700/60 max-w-full"
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-1.5 shadow-2xl">
                <span className="text-[10px] font-mono text-slate-400 self-start bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Sheet / Page {currentPage} of {numPages}
                </span>
                <canvas
                  ref={(el) => {
                    canvasRefs.current[currentPage] = el;
                  }}
                  className="rounded-lg shadow-2xl bg-white border border-slate-700/60 max-w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
