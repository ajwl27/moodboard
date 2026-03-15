import { useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { GroupRegion as GroupRegionType } from '../../types';

interface Props {
  obj: GroupRegionType;
}

export function GroupRegion({ obj }: Props) {
  const editingObjectId = useCanvasStore((s) => s.editingObjectId);
  const zoom = useCanvasStore((s) => s.camera.zoom);
  const isEditing = editingObjectId === obj.id;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useCanvasStore.getState().setEditingObjectId(obj.id);
  }, [obj.id]);

  const handleBlur = useCallback(() => {
    useCanvasStore.getState().setEditingObjectId(null);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useCanvasStore.setState((s) => ({
      objects: s.objects.map((o) => o.id === obj.id ? { ...o, label: e.target.value } : o),
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(obj.id),
    }));
  }, [obj.id]);

  // Counter-scale the label so it stays readable when zoomed out.
  // At zoom >= 1 the label renders at its natural 11px.
  // At zoom < 1 we scale up so the visual size never drops below ~11px.
  const counterScale = zoom < 1 ? 1 / zoom : 1;
  // Cap so the label doesn't dominate the group at very low zoom
  const scale = Math.min(counterScale, 4);

  return (
    <div onDoubleClick={handleDoubleClick} style={{ width: '100%', height: '100%', padding: 10 }}>
      {isEditing ? (
        <input
          ref={inputRef}
          value={obj.label}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') handleBlur(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 12 * scale, fontWeight: 700, color: 'var(--text-secondary)',
            border: '1.5px solid var(--accent)', borderRadius: 6,
            padding: '3px 8px', outline: 'none', background: 'white',
            boxShadow: '0 0 0 3px var(--accent-light)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            transformOrigin: 'top left',
          }}
        />
      ) : (
        <span style={{
          fontSize: 11 * scale, fontWeight: 600, color: '#8A8078',
          userSelect: 'none', textTransform: 'uppercase', letterSpacing: '0.08em',
          transformOrigin: 'top left',
          display: 'inline-block',
        }}>
          {obj.label}
        </span>
      )}
    </div>
  );
}
