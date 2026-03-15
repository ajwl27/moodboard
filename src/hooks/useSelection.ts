import { useState, useCallback, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { rectsIntersect } from '../utils/geometry';
import type { Rect } from '../types';

export function useSelection(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const marqueeRef = useRef<Rect | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const store = useCanvasStore.getState();
      if (store.toolMode !== 'select') return;

      // Click on empty canvas → deselect
      if (!e.shiftKey) store.deselectAll();

      const el = containerRef.current!;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const onMove = (me: PointerEvent) => {
        const cx = me.clientX - rect.left;
        const cy = me.clientY - rect.top;
        const x = Math.min(sx, cx);
        const y = Math.min(sy, cy);
        const w = Math.abs(cx - sx);
        const h = Math.abs(cy - sy);
        if (w > 3 || h > 3) {
          const r = { x, y, width: w, height: h };
          marqueeRef.current = r;
          setMarquee(r);
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);

        const finalMarquee = marqueeRef.current;
        if (finalMarquee && finalMarquee.width > 3 && finalMarquee.height > 3) {
          const state = useCanvasStore.getState();
          const cam = state.camera;
          const canvasRect: Rect = {
            x: finalMarquee.x / cam.zoom - cam.x,
            y: finalMarquee.y / cam.zoom - cam.y,
            width: finalMarquee.width / cam.zoom,
            height: finalMarquee.height / cam.zoom,
          };
          const hits = state.objects.filter((obj) =>
            rectsIntersect(canvasRect, { x: obj.x, y: obj.y, width: obj.width, height: obj.height }),
          );
          const ids = new Set(hits.map((o) => o.id));
          if (e.shiftKey) {
            const merged = new Set(state.selectedIds);
            ids.forEach((id) => merged.add(id));
            state.setSelectedIds(merged);
          } else {
            state.setSelectedIds(ids);
          }
        }

        marqueeRef.current = null;
        setMarquee(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [containerRef],
  );

  return { marquee, onPointerDown };
}
