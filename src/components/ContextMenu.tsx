import React, { useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { boundingRect, clamp } from '../utils/geometry';

interface Props {
  x: number;
  y: number;
  targetElement: HTMLElement;
  onClose: () => void;
}

export function ContextMenu({ x, y, targetElement, onClose }: Props) {
  const store = useCanvasStore.getState();
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const layers = useCanvasStore((s) => s.layers);
  const [showLayerSubmenu, setShowLayerSubmenu] = useState(false);

  const objectEl = targetElement.closest('[data-object-id]');
  const objectId = objectEl?.getAttribute('data-object-id') ?? null;
  const hasSelection = selectedIds.size > 0;

  const menu: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(20px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04)',
    padding: 6,
    minWidth: 190,
    zIndex: 99999,
    fontSize: 13,
    animation: 'menuIn 0.12s ease-out',
  };

  const item: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontSize: 13,
    color: 'var(--text)',
    borderRadius: 8,
    fontWeight: 450,
    transition: 'all 0.1s',
  };

  const danger: React.CSSProperties = { ...item, color: 'var(--danger)' };
  const sep = <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 6px' }} />;

  const hover = (e: React.MouseEvent, isDanger = false) => {
    (e.currentTarget as HTMLElement).style.background = isDanger ? 'var(--danger-light)' : 'var(--accent-light)';
    if (!isDanger) (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
  };
  const unhover = (e: React.MouseEvent, isDanger = false) => {
    (e.currentTarget as HTMLElement).style.background = 'none';
    (e.currentTarget as HTMLElement).style.color = isDanger ? 'var(--danger)' : 'var(--text)';
  };

  if (objectId || hasSelection) {
    const obj = objectId ? store.objects.find((o) => o.id === objectId) : null;
    return (
      <div style={menu} onClick={(e) => e.stopPropagation()}>
        <button style={item} onClick={() => { store.copySelected(); store.pasteClipboard(); onClose(); }}
          onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
          Duplicate
        </button>
        <button style={item} onClick={() => { store.copySelected(); onClose(); }}
          onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
          Copy
        </button>
        {sep}
        <button style={item} onClick={() => {
          const maxZ = store.getMaxZIndex();
          store.updateObjects([...selectedIds].map((id) => ({ id, changes: { zIndex: maxZ + 1 } })));
          onClose();
        }} onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
          Bring to Front
        </button>
        <button style={item} onClick={() => {
          const minZ = store.getMinZIndex();
          store.updateObjects([...selectedIds].map((id) => ({ id, changes: { zIndex: minZ - 1 } })));
          onClose();
        }} onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
          Send to Back
        </button>
        {sep}
        {layers.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button style={item}
              onMouseEnter={(e) => { hover(e); setShowLayerSubmenu(true); }}
              onMouseLeave={(e) => { unhover(e); }}
              onClick={() => setShowLayerSubmenu(!showLayerSubmenu)}
            >
              Move to layer
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>{'>'}</span>
            </button>
            {showLayerSubmenu && (
              <div
                style={{
                  position: 'absolute', left: '100%', top: 0, marginLeft: 4,
                  background: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.6)', borderRadius: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: 4, minWidth: 140,
                  zIndex: 100000,
                }}
                onMouseEnter={() => setShowLayerSubmenu(true)}
                onMouseLeave={() => setShowLayerSubmenu(false)}
              >
                <button style={item} onClick={() => { store.moveSelectedToLayer(null); onClose(); }}
                  onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#6366f1', flexShrink: 0 }} />
                  Default
                </button>
                {layers.map((l) => (
                  <button key={l.id} style={item} onClick={() => { store.moveSelectedToLayer(l.id); onClose(); }}
                    onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.colour, flexShrink: 0 }} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {sep}
        {obj && obj.type === 'image' && selectedIds.size === 1 && (
          <button style={item} onClick={() => { store.setCropModalObjectId(obj.id); onClose(); }}
            onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
            Crop Image
          </button>
        )}
        {obj && (
          <button style={item} onClick={() => { store.updateObject(obj.id, { locked: !obj.locked }); onClose(); }}
            onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
            {obj.locked ? 'Unlock' : 'Lock'}
          </button>
        )}
        <button style={danger} onClick={() => { store.deleteSelectedObjects(); onClose(); }}
          onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => unhover(e, true)}>
          Delete
        </button>
      </div>
    );
  }

  return (
    <div style={menu} onClick={(e) => e.stopPropagation()}>
      <button style={item} onClick={() => {
        const cam = store.camera;
        const el = targetElement.closest('[class*="container"]') as HTMLElement;
        if (!el) { onClose(); return; }
        const rect = el.getBoundingClientRect();
        const cx = (x - rect.left) / cam.zoom - cam.x;
        const cy = (y - rect.top) / cam.zoom - cam.y;
        store.addObject({
          id: crypto.randomUUID(), boardId: store.boardId!, type: 'text',
          x: cx, y: cy, width: 200, height: 100,
          zIndex: store.getMaxZIndex() + 1, locked: false, colour: '#ffffff',
          content: '', fontSize: 14, layerId: store.activeLayerId,
        });
        store.setEditingObjectId(store.objects[store.objects.length - 1]?.id ?? '');
        onClose();
      }} onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
        Add Text
      </button>
      <button style={item} onClick={() => {
        if (store.clipboardObjects.length > 0) store.pasteClipboard();
        onClose();
      }} onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
        Paste
      </button>
      {sep}
      <button style={item} onClick={() => {
        const rects = store.objects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
        if (rects.length === 0) { onClose(); return; }
        const bounds = boundingRect(rects);
        if (!bounds) { onClose(); return; }
        const padding = 80;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scaleX = (vw - padding * 2) / bounds.width;
        const scaleY = (vh - padding * 2) / bounds.height;
        const zoom = clamp(Math.min(scaleX, scaleY), 0.1, 5);
        const ccx = bounds.x + bounds.width / 2;
        const ccy = bounds.y + bounds.height / 2;
        useCanvasStore.setState({ camera: { x: (vw / 2) / zoom - ccx, y: (vh / 2) / zoom - ccy, zoom }, boardDirty: true });
        onClose();
      }} onMouseEnter={(e) => hover(e)} onMouseLeave={(e) => unhover(e)}>
        Zoom to Fit
      </button>
    </div>
  );
}
