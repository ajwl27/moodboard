import { useCanvasStore } from '../../stores/canvasStore';

export function DrawToolBar() {
  const brushSize = useCanvasStore((s) => s.drawBrushSize);
  const brushColour = useCanvasStore((s) => s.drawBrushColour);
  const isEraser = useCanvasStore((s) => s.drawIsEraser);

  const bar: React.CSSProperties = {
    position: 'absolute',
    top: 56,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 1001,
    background: 'rgba(250, 248, 245, 0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 12,
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
    padding: '8px 14px',
    animation: 'menuIn 0.12s ease-out',
  };

  const modeBtn = (active: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#faf8f5' : 'var(--text-secondary)',
    border: active ? 'none' : '1.5px solid var(--border)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    padding: 0,
    flexShrink: 0,
  });

  return (
    <div style={bar}>
      {/* Close / exit draw mode */}
      <button
        onClick={() => useCanvasStore.getState().setToolMode('select')}
        title="Exit draw mode (Esc)"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--danger-light, rgba(220,38,38,0.08))';
          e.currentTarget.style.color = 'var(--danger, #dc2626)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: 'var(--border-light)', flexShrink: 0 }} />

      {/* Brush / Eraser toggle */}
      <button
        style={modeBtn(!isEraser)}
        onClick={() => useCanvasStore.getState().setDrawIsEraser(false)}
        title="Brush (B)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </button>
      <button
        style={modeBtn(isEraser)}
        onClick={() => useCanvasStore.getState().setDrawIsEraser(true)}
        title="Eraser (E)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: 'var(--border-light)', flexShrink: 0 }} />

      {/* Brush size preview + slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: Math.max(4, Math.min(brushSize, 20)),
            height: Math.max(4, Math.min(brushSize, 20)),
            borderRadius: '50%',
            background: isEraser ? 'var(--text-tertiary)' : brushColour,
          }} />
        </div>
        <input
          type="range"
          min="1"
          max="30"
          step="1"
          value={brushSize}
          onChange={(e) => useCanvasStore.getState().setDrawBrushSize(parseInt(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 140,
            height: 4,
            accentColor: 'var(--accent)',
            cursor: 'pointer',
          }}
          title={`Brush size: ${brushSize}px`}
        />
        <span style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--mono)',
          minWidth: 22,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {brushSize}
        </span>
      </div>

      {/* Colour picker (brush mode only) */}
      {!isEraser && (
        <>
          <div style={{ width: 1, height: 24, background: 'var(--border-light)', flexShrink: 0 }} />
          <input
            type="color"
            value={brushColour}
            onChange={(e) => useCanvasStore.getState().setDrawBrushColour(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 30,
              height: 30,
              border: '2px solid var(--border)',
              borderRadius: 8,
              padding: 0,
              cursor: 'pointer',
              background: 'none',
              flexShrink: 0,
            }}
            title="Brush colour"
          />
        </>
      )}

    </div>
  );
}
