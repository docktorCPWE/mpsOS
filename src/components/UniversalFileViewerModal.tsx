import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Trash2, ZoomIn, ZoomOut, RotateCw, FileText, Maximize2 } from 'lucide-react';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { downloadFileFromUrl, openFileInNewTab } from '../utils/attachmentUtils';

export interface ViewableFile {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
  title?: string;
  category?: string;
  version?: string;
  uploadedAt?: string;
  authorDrafter?: string;
  notes?: string;
}

interface UniversalFileViewerModalProps {
  file: ViewableFile | null;
  onClose: () => void;
  onDelete?: (file: ViewableFile) => void;
  subtitle?: string;
}

export const UniversalFileViewerModal: React.FC<UniversalFileViewerModalProps> = ({
  file,
  onClose,
  onDelete,
  subtitle
}) => {
  const [imageScale, setImageScale] = useState<number>(1.0);
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Reset controls when file changes
  useEffect(() => {
    setImageScale(1.0);
    setImageRotation(0);
  }, [file?.id, file?.url]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const fileName = file.name || file.title || 'Attached File';
  const fileUrl = file.url || '';
  const lowerName = fileName.toLowerCase();
  
  const isPdf = fileUrl.startsWith('data:application/pdf') || 
                lowerName.endsWith('.pdf') || 
                file.type?.includes('pdf') ||
                fileUrl.includes('.pdf');

  const isImage = fileUrl.startsWith('data:image') || 
                  lowerName.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/) !== null ||
                  file.type?.startsWith('image/') ||
                  fileUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i) !== null;

  const isCad = lowerName.endsWith('.dwg') || lowerName.endsWith('.dxf') || file.type?.includes('acad');
  const isDoc = lowerName.match(/\.(doc|docx|odt|rtf|txt)$/) !== null;

  const handleDownload = () => {
    downloadFileFromUrl(fileUrl, fileName);
  };

  const handleOpenInNewTab = () => {
    openFileInNewTab(fileUrl, fileName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-[96vw] max-w-6xl h-[92vh] overflow-hidden text-white shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {file.category && (
              <span className="text-[10px] font-mono font-bold text-blue-400 uppercase bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800 shrink-0">
                {file.category} {file.version ? `(${file.version})` : ''}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white truncate max-w-lg" title={fileName}>
                  {fileName}
                </span>
                {file.size && (
                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    ({file.size})
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Actions in Header */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
              title="Open file in a native browser window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Tab</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer active:scale-95"
              title="Download original file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
          {/* PDF Viewer */}
          {isPdf && fileUrl ? (
            <div className="w-full h-full">
              <PdfCanvasViewer url={fileUrl} filename={fileName} />
            </div>
          ) : isImage && fileUrl ? (
            /* High-Res Image Viewer with Zoom & Pan */
            <div className="w-full h-full flex flex-col">
              {/* Image Control Bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs select-none shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImageScale(s => Math.max(0.4, s - 0.2))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-slate-300 w-12 text-center text-[11px]">
                    {Math.round(imageScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageScale(s => Math.min(4.0, s + 0.2))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageScale(1.0)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer"
                    title="Actual Size (100%)"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageRotation(r => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer ml-1"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Full Resolution Image
                </div>
              </div>

              {/* Image Canvas Container */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60">
                <div 
                  className="transition-transform duration-100 ease-out flex items-center justify-center max-w-none"
                  style={{
                    transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg border border-slate-800 shadow-2xl bg-white/5"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Non-renderable File Format (CAD, Word, etc.) */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
              <div className="w-20 h-20 rounded-2xl bg-blue-950/70 border border-blue-700/60 text-blue-400 flex items-center justify-center mb-4 shadow-xl">
                <FileText className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{fileName}</h3>
              <p className="text-xs text-slate-400 font-mono mb-4">
                {file.size || 'Unknown size'} • {isCad ? 'CAD / DWG File' : isDoc ? 'Document File' : (file.type || 'Binary Attachment')}
              </p>
              <p className="text-xs text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
                {isCad 
                  ? 'CAD files are best viewed in AutoCAD, Chief Architect, or Revit. Click below to download the original drawing file to your computer.' 
                  : 'This file format is ready for local editing. Click below to download the original file to your device.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Original File</span>
                </button>
                {fileUrl && (
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Tab</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* User's Manual Notes (only if author actually typed custom notes, never auto-generated text) */}
          {file.notes && file.notes.trim() && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 text-xs text-slate-300 flex items-start gap-2 shrink-0">
              <span className="font-bold text-blue-400 shrink-0">Notes:</span>
              <p className="italic text-slate-300">{file.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(file)}
                className="bg-red-950/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/60 font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer group/prevdel"
                title="Delete file permanently from project & database"
              >
                <Trash2 className="w-3.5 h-3.5 transition group-hover/prevdel:scale-110" />
                <span>Delete File</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Tab</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Original</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-1.5 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
