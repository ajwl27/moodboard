import { useRef, useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

export function useDragMove(_containerRef: React.RefObject<HTMLDivElement | null>) {
  const [dragging, setDragging] = useState(false);
  const startPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const mouseStartRef = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const state = useCanvasStore.getState();
      if (state.selectedIds.size === 0) return;

      mouseStartRef.current = { x: e.clientX, y: e.clientY };

      // Record start positions
      const starts = new Map<string, { x: number; y: number }>();
      for (const id of state.selectedIds) {
        const obj = state.objects.find((o) => o.id === id);
        if (obj && !obj.locked) starts.set(id, { x: obj.x, y: obj.y });
      }

      // If any dragged object is a group, also drag objects contained inside it
      let prevSize = 0;
      while (starts.size !== prevSize) {
        prevSize = starts.size;
        const groups = state.objects.filter((o) => starts.has(o.id) && o.type === 'group');
        for (const obj of state.objects) {
          if (starts.has(obj.id) || obj.locked || obj.type === 'arrow') continue;
          for (const group of groups) {
            if (
              obj.x >= group.x &&
              obj.y >= group.y &&
              obj.x + obj.width <= group.x + group.width &&
              obj.y + obj.height <= group.y + group.height
            ) {
              starts.set(obj.id, { x: obj.x, y: obj.y });
              break;
            }
          }
        }
      }

      startPosRef.current = starts;
      if (starts.size === 0) return;

      setDragging(true);
      let moved = false;

      // Snapshot for undo
      const prevObjects = state.objects.filter((o) => starts.has(o.id)).map((o) => ({ ...o }));

      const onMove = (me: PointerEvent) => {
        const zoom = useCanvasStore.getState().camera.zoom;
        const dx = (me.clientX - mouseStartRef.current.x) / zoom;
        const dy = (me.clientY - mouseStartRef.current.y) / zoom;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;

        const store = useCanvasStore.getState();
        const gridEnabled = store.gridEnabled;
        const gridSize = store.gridSize;

        useCanvasStore.setState((s) => ({
          objects: s.objects.map((o) => {
            const start = starts.get(o.id);
            if (!start) return o;
            let newX = start.x + dx;
            let newY = start.y + dy;
            if (gridEnabled) {
              newX = Math.round(newX / gridSize) * gridSize;
              newY = Math.round(newY / gridSize) * gridSize;
            }
            return { ...o, x: newX, y: newY };
          }),
        }));
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDragging(false);

        if (moved) {
          const state = useCanvasStore.getState();
          const currentObjects = state.objects.filter((o) => starts.has(o.id)).map((o) => ({ ...o }));
          const dirty = new Set(state.dirtyObjectIds);
          starts.forEach((_, id) => dirty.add(id));

          // Replace the auto-generated history entry with a proper one
          useCanvasStore.setState((s) => ({
            dirtyObjectIds: dirty,
            undoStack: [
              ...s.undoStack.slice(0, -1),
              { undo: prevObjects, redo: currentObjects },
            ],
          }));
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [],
  );

  return { onPointerDown, dragging };
}
