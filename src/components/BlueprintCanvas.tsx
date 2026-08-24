import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Layers, Eye, EyeOff, Pin, PlusCircle, CheckCircle2, FileText, Download } from 'lucide-react';
import { Job, PinnedLocation } from '../types';

interface BlueprintCanvasProps {
  job: Job;
  onAddPinnedComment?: (loc: PinnedLocation, text: string) => void;
  readOnly?: boolean;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({ job, onAddPinnedComment, readOnly = false }) => {
  const [zoom, setZoom] = useState(1);
  const [activeSheet, setActiveSheet] = useState<'floor_plan' | 'elevation'>('floor_plan');
  const [layers, setLayers] = useState({
    walls: true,
    dimensions: true,
    labels: true,
    furniture: true,
    electrical: false,
    pins: true,
  });
  
  const [newPinPoint, setNewPinPoint] = useState<PinnedLocation | null>(null);
  const [newPinText, setNewPinText] = useState('');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onAddPinnedComment) return;
    
    // Calculate click location percentage on canvas (0-100%)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    setNewPinPoint({ x, y, page: activeSheet });
    setNewPinText('');
  };

  const handleConfirmPin = () => {
    if (newPinPoint && newPinText.trim() && onAddPinnedComment) {
      onAddPinnedComment(newPinPoint, newPinText.trim());
      setNewPinPoint(null);
      setNewPinText('');
    }
  };

  const pinnedComments = job.comments.filter(c => c.pinnedLocation);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col font-sans">
      
      {/* Blueprint Header Toolbar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        
        {/* Sheet Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveSheet('floor_plan')}
            className={`px-3 py-1 rounded font-medium transition ${
              activeSheet === 'floor_plan' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sheet A1: Main Level Floor Plan
          </button>
          <button
            onClick={() => setActiveSheet('elevation')}
            className={`px-3 py-1 rounded font-medium transition ${
              activeSheet === 'elevation' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sheet A2: Exterior Front Elevation
          </button>
        </div>

        {/* CAD Layer Toggles */}
        <div className="hidden md:flex items-center gap-2 border-l border-r border-slate-800 px-3">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Layers:</span>
          
          <button
            onClick={() => setLayers(l => ({ ...l, dimensions: !l.dimensions }))}
            className={`px-2 py-0.5 rounded border text-[11px] ${
              layers.dimensions ? 'bg-blue-950 text-blue-300 border-blue-700' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            Dimensions
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, furniture: !l.furniture }))}
            className={`px-2 py-0.5 rounded border text-[11px] ${
              layers.furniture ? 'bg-blue-950 text-blue-300 border-blue-700' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            Furniture Layout
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, electrical: !l.electrical }))}
            className={`px-2 py-0.5 rounded border text-[11px] ${
              layers.electrical ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            Electrical Sw
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, pins: !l.pins }))}
            className={`px-2 py-0.5 rounded border text-[11px] ${
              layers.pins ? 'bg-indigo-950 text-indigo-300 border-indigo-700' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            Pins ({pinnedComments.length})
          </button>
        </div>

        {/* Zoom Controls & Scale Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 rounded border border-slate-800">
            <button
              onClick={() => setZoom(z => Math.max(0.75, z - 0.15))}
              className="p-1.5 hover:bg-slate-800 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-blue-400 font-bold">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
              className="p-1.5 hover:bg-slate-800 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 hover:bg-slate-800 text-slate-300 border-l border-slate-800"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="hidden sm:inline font-mono text-[10px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">
            SCALE: 1/4" = 1'-0"
          </span>
        </div>

      </div>

      {/* Main Canvas Container (Interactive Architectural View) */}
      <div className="relative min-h-[460px] max-h-[560px] overflow-auto bg-slate-950 p-6 flex justify-center items-center cursor-crosshair group">
        
        {/* Subtle Architectural Grid Pattern Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`
          }}
        />

        {/* Architectural Sheet Container */}
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="relative transition-transform duration-200 ease-out bg-[#0b1329] border-2 border-blue-900/60 shadow-2xl rounded-sm p-8 w-[800px] h-[500px] select-none"
        >
          {/* Blueprint Title Block (Bottom Right CAD stamp) */}
          <div className="absolute bottom-4 right-4 bg-slate-950/90 border border-blue-800/80 p-3 rounded text-[10px] text-slate-300 font-mono w-56 shadow-lg z-10 pointer-events-none">
            <div className="text-blue-400 font-bold border-b border-slate-800 pb-1 mb-1 flex justify-between">
              <span>MY PLAN STORE OS</span>
              <span>JOB: {job.job_number}</span>
            </div>
            <p className="truncate"><strong>PROJECT:</strong> {job.customer_name}</p>
            <p><strong>STYLE:</strong> {job.style} ({job.sq_ft} SQ FT)</p>
            <p><strong>DRAFTER:</strong> {job.assigned_drafter.split(',')[0]}</p>
            <p className="text-blue-300 mt-1 pt-1 border-t border-slate-800">
              STATUS: <span className="font-bold uppercase text-white">{job.current_status}</span>
            </p>
          </div>

          {/* Blueprint North Compass & Scale Indicator */}
          <div className="absolute top-4 left-4 border border-blue-900/50 bg-slate-950/70 p-2 rounded text-[10px] font-mono text-blue-300 flex items-center gap-2 pointer-events-none">
            <div className="w-6 h-6 border-2 border-blue-400 rounded-full flex items-center justify-center font-bold text-[9px] text-blue-300">
              N
            </div>
            <div>
              <p>MAIN LEVEL PLAN</p>
              <p className="text-slate-500 text-[9px]">CAD VERSION {job.deliverables[0]?.version || 'v1.0'}</p>
            </div>
          </div>

          {/* SHEET CONTENT: Floor Plan or Exterior Elevation */}
          {activeSheet === 'floor_plan' ? (
            <div className="w-full h-full relative">
              {/* SVG Floor Plan Drawing Layer */}
              <svg className="w-full h-full text-blue-400" viewBox="0 0 800 500">
                
                {/* External Walls */}
                {layers.walls && (
                  <g stroke="#3b82f6" strokeWidth="4" fill="none" strokeLinecap="square">
                    {/* Outer Boundary */}
                    <rect x="80" y="60" width="640" height="360" rx="2" stroke="#60a5fa" strokeWidth="6" />
                    
                    {/* Interior Wall Divisions */}
                    <line x1="320" y1="60" x2="320" y2="420" strokeWidth="3" />
                    <line x1="80" y1="260" x2="320" y2="260" strokeWidth="3" />
                    <line x1="320" y1="200" x2="720" y2="200" strokeWidth="3" />
                    <line x1="520" y1="200" x2="520" y2="420" strokeWidth="3" />

                    {/* Door Arcs & Swing indicators */}
                    <path d="M 320 180 A 40 40 0 0 1 360 200" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3,3" />
                    <path d="M 520 280 A 40 40 0 0 1 560 300" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3,3" />
                  </g>
                )}

                {/* Furniture Layout Layer */}
                {layers.furniture && (
                  <g stroke="#475569" strokeWidth="1.5" fill="#0f172a">
                    {/* Kitchen Island */}
                    <rect x="360" y="250" width="120" height="60" rx="4" fill="#1e293b" stroke="#38bdf8" />
                    <text x="420" y="285" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle">KITCHEN ISLAND</text>

                    {/* Great Room Sofa */}
                    <rect x="360" y="90" width="130" height="50" rx="6" fill="#1e293b" stroke="#475569" />
                    
                    {/* Master Bed */}
                    <rect x="560" y="250" width="120" height="130" rx="4" fill="#1e293b" stroke="#475569" />
                    
                    {/* Covered Porch Table */}
                    <circle cx="180" cy="140" r="30" fill="#1e293b" stroke="#475569" />
                  </g>
                )}

                {/* CAD Dimensions Lines */}
                {layers.dimensions && (
                  <g stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" fill="#f59e0b">
                    {/* Top Overall Dimension */}
                    <line x1="80" y1="35" x2="720" y2="35" stroke="#f59e0b" />
                    <text x="400" y="28" fill="#fbbf24" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      64'-0" OVERALL
                    </text>
                    
                    {/* Left Overall Dimension */}
                    <line x1="45" y1="60" x2="45" y2="420" stroke="#f59e0b" />
                    <text x="35" y="240" fill="#fbbf24" fontSize="11" fontFamily="monospace" textAnchor="middle" transform="rotate(-90 35 240)" fontWeight="bold">
                      36'-0" OVERALL
                    </text>

                    {/* Room dimensions */}
                    <text x="200" y="180" fill="#fbbf24" fontSize="10" fontFamily="monospace" textAnchor="middle">20' x 18'</text>
                    <text x="420" y="140" fill="#fbbf24" fontSize="10" fontFamily="monospace" textAnchor="middle">24' x 16'</text>
                    <text x="620" y="320" fill="#fbbf24" fontSize="10" fontFamily="monospace" textAnchor="middle">18' x 20'</text>
                  </g>
                )}

                {/* Electrical Symbols */}
                {layers.electrical && (
                  <g fill="#fbbf24" stroke="#fbbf24" strokeWidth="1">
                    <circle cx="420" cy="100" r="6" fill="none" stroke="#fbbf24" strokeWidth="2" />
                    <circle cx="200" cy="140" r="6" fill="none" stroke="#fbbf24" strokeWidth="2" />
                    <circle cx="620" cy="280" r="6" fill="none" stroke="#fbbf24" strokeWidth="2" />
                  </g>
                )}

                {/* Room Labels Layer */}
                {layers.labels && (
                  <g fill="#93c5fd" fontFamily="monospace" fontSize="12" fontWeight="bold">
                    <text x="200" y="160" textAnchor="middle">COVERED PORCH</text>
                    <text x="200" y="340" textAnchor="middle">2-CAR GARAGE</text>
                    <text x="420" y="120" textAnchor="middle">GREAT ROOM</text>
                    <text x="420" y="380" textAnchor="middle">DINING / FOYER</text>
                    <text x="620" y="110" textAnchor="middle">GUEST BED / OPTION</text>
                    <text x="620" y="300" textAnchor="middle">PRIMARY SUITE</text>
                  </g>
                )}

              </svg>
            </div>
          ) : (
            /* Exterior Front Elevation Drawing */
            <div className="w-full h-full relative">
              <svg className="w-full h-full text-blue-400" viewBox="0 0 800 500">
                {/* Ground Line */}
                <line x1="40" y1="400" x2="760" y2="400" stroke="#38bdf8" strokeWidth="3" />
                <text x="100" y="420" fill="#38bdf8" fontSize="10" fontFamily="monospace">GRADE / FINISHED GROUND</text>

                {/* House Silhouette & Gable Roof */}
                <polygon points="100,400 100,220 260,110 420,220 700,220 700,400" fill="#0f172a" stroke="#60a5fa" strokeWidth="4" />
                
                {/* Timber Porch Columns */}
                <rect x="200" y="260" width="16" height="140" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
                <rect x="320" y="260" width="16" height="140" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
                
                {/* Front Double Door */}
                <rect x="240" y="280" width="56" height="120" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" />
                
                {/* Windows */}
                <rect x="140" y="260" width="40" height="70" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <rect x="480" y="260" width="60" height="80" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <rect x="580" y="260" width="60" height="80" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />

                {/* Elevation Dimensions & Pitch Indicators */}
                {layers.dimensions && (
                  <g fill="#f59e0b" stroke="#f59e0b" fontSize="10" fontFamily="monospace">
                    <path d="M 220 160 L 260 160 L 260 135 Z" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                    <text x="235" y="152">8/12 Pitch</text>
                    <line x1="720" y1="110" x2="720" y2="400" strokeDasharray="2,2" />
                    <text x="730" y="260">24'-6" RIDGE HT</text>
                  </g>
                )}

                <text x="400" y="80" fill="#93c5fd" fontSize="14" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  FRONT ELEVATION - {job.style.toUpperCase()}
                </text>
              </svg>
            </div>
          )}

          {/* Pinned Comments Markers Layer */}
          {layers.pins && pinnedComments.map((comment, idx) => {
            if (!comment.pinnedLocation) return null;
            const { x, y } = comment.pinnedLocation;
            return (
              <div
                key={comment.id || idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPinId(selectedPinId === comment.id ? null : comment.id);
                }}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group/pin"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-4 ring-blue-500/30 shadow-lg group-hover/pin:scale-110 transition">
                    <Pin className="w-3.5 h-3.5" />
                  </div>

                  {/* Comment Hover Popup */}
                  <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs text-slate-200 z-30 transition pointer-events-auto ${
                    selectedPinId === comment.id ? 'block' : 'hidden group-hover/pin:block'
                  }`}>
                    <p className="font-bold text-blue-400 mb-0.5">{comment.author} ({comment.role})</p>
                    <p className="text-slate-300 leading-snug">{comment.text}</p>
                    <p className="text-[9px] text-slate-500 mt-1 font-mono">
                      {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* New Pin Modal Popover when user clicks on Canvas */}
          {newPinPoint && (
            <div
              style={{ left: `${newPinPoint.x}%`, top: `${newPinPoint.y}%` }}
              onClick={(e) => e.stopPropagation()}
              className="absolute -translate-x-1/2 top-4 z-40 bg-slate-900 border border-blue-500 p-3.5 rounded-xl shadow-2xl w-64 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-2">
                <Pin className="w-4 h-4 text-blue-400 animate-bounce" />
                <span>Add Location Feedback Pin</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Pin dropped at location ({newPinPoint.x}%, {newPinPoint.y}%).
              </p>
              <textarea
                value={newPinText}
                onChange={(e) => setNewPinText(e.target.value)}
                placeholder="e.g. Can we widen this hallway to 4ft or shift island 2ft left?"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-2 h-20 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setNewPinPoint(null)}
                  className="px-2.5 py-1 text-slate-400 hover:text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPin}
                  disabled={!newPinText.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded"
                >
                  Save Pin
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Blueprint Footer Bar */}
      <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Interactive Plan CAD Canvas: Click anywhere to drop feedback markup pin
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert(`Downloading high resolution Vector PDF for ${job.job_number}...`)}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CAD Sheet (.PDF)</span>
          </button>
        </div>
      </div>

    </div>
  );
};
