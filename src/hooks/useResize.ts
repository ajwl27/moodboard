import { useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN_WIDTH = 50;
const MIN_HEIGHT = 30;

export function useResize(_containerRef: React.RefObject<HTMLDivElement | null>) {
  const [resizing, setResizing] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, objId: string, direction: ResizeDirection) => {
      e.stopPropagation();
      e.preventDefault();

      const state = useCanvasStore.getState();
      const obj = state.objects.find((o) => o.id === objId);
      if (!obj || obj.locked) return;

      const prevObj = { ...obj };
      const startX = e.clientX;
      const startY = e.clientY;
      const origRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
      const isImage = obj.type === 'image';
      const aspect = origRect.width / origRect.height;

      setResizing(true);

      const onMove = (me: PointerEvent) => {
        const zoom = useCanvasStore.getState().camera.zoom;
        const dx = (me.clientX - startX) / zoom;
        const dy = (me.clientY - startY) / zoom;

        let newX = origRect.x;
        let newY = origRect.y;
        let newW = origRect.width;
        let newH = origRect.height;

        if (direction.includes('e')) newW = origRect.width + dx;
        if (direction.includes('w')) { newW = origRect.width - dx; newX = origRect.x + dx; }
        if (direction.includes('s')) newH = origRect.height + dy;
        if (direction.includes('n')) { newH = origRect.height - dy; newY = origRect.y + dy; }

        // Aspect ratio for images on corner drag
        if (isImage && direction.length === 2) {
          if (Math.abs(dx) > Math.abs(dy)) {
            newH = newW / aspect;
            if (direction.includes('n')) newY = origRect.y + origRect.height - newH;
          } else {
            newW = newH * aspect;
            if (direction.includes('w')) newX = origRect.x + origRect.width - newW;
          }
        }

        // Clamp minimum size
        if (newW < MIN_WIDTH) {
          if (direction.includes('w')) newX = origRect.x + origRect.width - MIN_WIDTH;
          newW = MIN_WIDTH;
        }
        if (newH < MIN_HEIGHT) {
          if (direction.includes('n')) newY = origRect.y + origRect.height - MIN_HEIGHT;
          newH = MIN_HEIGHT;
        }

        useCanvasStore.setState((s) => ({
          objects: s.objects.map((o) =>
            o.id === objId ? { ...o, x: newX, y: newY, width: newW, height: newH } : o,
          ),
          dirtyObjectIds: new Set(s.dirtyObjectIds).add(objId),
        }));
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setResizing(false);

        const current = useCanvasStore.getState().objects.find((o) => o.id === objId);
        if (current) {
          useCanvasStore.setState((s) => ({
            undoStack: [
              ...s.undoStack,
              { undo: [prevObj], redo: [{ ...current }] },
            ],
            redoStack: [],
          }));
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [],
  );

  return { onPointerDown, resizing };
}
