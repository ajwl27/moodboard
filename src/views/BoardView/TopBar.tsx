import { useState, useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { updateBoard, getBoard } from '../../db/boards';
import { exportCanvas } from '../../utils/exportCanvas';
import type { NavigateFunction } from 'react-router-dom';

interface Props {
  navigate: NavigateFunction;
}

export function TopBar({ navigate }: Props) {
  const boardId = useCanvasStore((s) => s.boardId);
  const camera = useCanvasStore((s) => s.camera);
  const gridEnabled = useCanvasStore((s) => s.gridEnabled);
  const toggleGrid = useCanvasStore((s) => s.toggleGrid);
  const layersPanelOpen = useCanvasStore((s) => s.layersPanelOpen);
  const toggleLayersPanel = useCanvasStore((s) => s.toggleLayersPanel);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boardId) return;
    getBoard(boardId).then((b) => { if (b) setTitle(b.title); });
  }, [boardId]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitTitle = useCallback(async () => {
    setEditing(false);
    if (boardId && title.trim()) {
      await updateBoard(boardId, { title: title.trim() });
    }
  }, [boardId, title]);

  const handleExport = useCallback(async (format: 'png' | 'jpg' | 'pdf') => {
    if (!boardId || exporting) return;
    setExporting(true);
    setExportOpen(false);
    try {
      await exportCanvas(boardId, format, title);
    } finally {
      setExporting(false);
    }
  }, [boardId, title, exporting]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [exportOpen]);

  const zoomPercent = Math.round(camera.zoom * 100);

  const bar: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    height: 48,
    background: 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    borderRadius: 14,
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px 0 6px',
    gap: 4,
    zIndex: 1000,
  };

  const btn: React.CSSProperties = {
    height: 36,
    padding: '0 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
    cursor: 'pointer',
  };

  return (
    <div style={bar}>
      <button
        onClick={() => navigate('/')}
        style={btn}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Home
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTitle();
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            border: '1.5px solid var(--accent)',
            borderRadius: 8,
            padding: '4px 10px',
            outline: 'none',
            background: 'white',
            boxShadow: '0 0 0 3px var(--accent-light)',
            color: 'var(--text)',
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            ...btn,
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '-0.2px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {title}
        </button>
      )}

      <div style={{ flex: 1 }} />

      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        padding: '0 8px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {zoomPercent}%
      </span>

      <button
        onClick={toggleGrid}
        title="Toggle grid (G)"
        style={{
          ...btn,
          background: gridEnabled ? 'var(--accent)' : 'transparent',
          color: gridEnabled ? 'white' : 'var(--text-secondary)',
          borderRadius: 10,
          padding: '0 12px',
        }}
        onMouseEnter={(e) => { if (!gridEnabled) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; } }}
        onMouseLeave={(e) => { if (!gridEnabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="3" x2="3" y2="21" /><line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" /><line x1="21" y1="3" x2="21" y2="21" />
          <line x1="3" y1="3" x2="21" y2="3" /><line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" /><line x1="3" y1="21" x2="21" y2="21" />
        </svg>
        Grid
      </button>

      <button
        onClick={toggleLayersPanel}
        title="Toggle layers (L)"
        style={{
          ...btn,
          background: layersPanelOpen ? 'var(--accent)' : 'transparent',
          color: layersPanelOpen ? 'white' : 'var(--text-secondary)',
          borderRadius: 10,
          padding: '0 12px',
        }}
        onMouseEnter={(e) => { if (!layersPanelOpen) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; } }}
        onMouseLeave={(e) => { if (!layersPanelOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        Layers
      </button>

      <div ref={exportRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setExportOpen((o) => !o)}
          title="Export canvas"
          disabled={exporting}
          style={{
            ...btn,
            borderRadius: 10,
            padding: '0 12px',
            opacity: exporting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Exporting...' : 'Export'}
        </button>
        {exportOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            padding: 4,
            minWidth: 120,
            zIndex: 1001,
          }}>
            {([['png', 'PNG'], ['jpg', 'JPG'], ['pdf', 'PDF']] as const).map(([fmt, label]) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Export as {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
