import { useRef, useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { computeAlignmentGuides } from '../utils/alignmentGuides';
import type { Rect } from '../types';

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

      const draggedIds = new Set(starts.keys());
      const draggedObjSizes = new Map<string, { width: number; height: number }>();
      for (const obj of state.objects) {
        if (starts.has(obj.id)) {
          draggedObjSizes.set(obj.id, { width: obj.width, height: obj.height });
        }
      }

      const onMove = (me: PointerEvent) => {
        const zoom = useCanvasStore.getState().camera.zoom;
        const dx = (me.clientX - mouseStartRef.current.x) / zoom;
        const dy = (me.clientY - mouseStartRef.current.y) / zoom;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;

        const store = useCanvasStore.getState();
        const gridEnabled = store.gridEnabled;
        const gridSize = store.gridSize;

        let finalDx = dx;
        let finalDy = dy;

        if (gridEnabled) {
          // Grid snapping takes priority — no alignment guides
          useCanvasStore.setState((s) => ({
            objects: s.objects.map((o) => {
              const start = starts.get(o.id);
              if (!start) return o;
              return { ...o, x: Math.round((start.x + dx) / gridSize) * gridSize, y: Math.round((start.y + dy) / gridSize) * gridSize };
            }),
            activeGuides: [],
          }));
          return;
        }

        // Compute bounding rect of dragged objects at proposed position
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [id, start] of starts) {
          const size = draggedObjSizes.get(id)!;
          const nx = start.x + dx;
          const ny = start.y + dy;
          minX = Math.min(minX, nx);
          minY = Math.min(minY, ny);
          maxX = Math.max(maxX, nx + size.width);
          maxY = Math.max(maxY, ny + size.height);
        }
        const draggedRect: Rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

        // Get rects of non-dragged objects
        const otherRects: Rect[] = store.objects
          .filter((o) => !draggedIds.has(o.id) && o.type !== 'arrow')
          .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));

        const snap = computeAlignmentGuides(draggedRect, otherRects);
        finalDx = dx + snap.dx;
        finalDy = dy + snap.dy;

        useCanvasStore.setState((s) => ({
          objects: s.objects.map((o) => {
            const start = starts.get(o.id);
            if (!start) return o;
            return { ...o, x: start.x + finalDx, y: start.y + finalDy };
          }),
          activeGuides: snap.guides,
        }));
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDragging(false);
        useCanvasStore.getState().setActiveGuides([]);

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
