import { useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { CanvasObject } from '../types';

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

      const selectedIds = state.selectedIds;
      const isMulti = selectedIds.size > 1 && selectedIds.has(objId);

      if (isMulti) {
        startMultiResize(e, objId, direction, state);
      } else {
        startSingleResize(e, objId, direction, obj);
      }

      setResizing(true);
    },
    [],
  );

  // ── Single object resize (original behaviour) ──────────────

  function startSingleResize(
    e: React.PointerEvent,
    objId: string,
    direction: ResizeDirection,
    obj: CanvasObject,
  ) {
    const prevObj = { ...obj };
    const startX = e.clientX;
    const startY = e.clientY;
    const origRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    const isImage = obj.type === 'image';
    const aspect = origRect.width / origRect.height;

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

      if (isImage && direction.length === 2) {
        if (Math.abs(dx) > Math.abs(dy)) {
          newH = newW / aspect;
          if (direction.includes('n')) newY = origRect.y + origRect.height - newH;
        } else {
          newW = newH * aspect;
          if (direction.includes('w')) newX = origRect.x + origRect.width - newW;
        }
      }

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
  }

  // ── Multi-object resize ────────────────────────────────────

  function startMultiResize(
    e: React.PointerEvent,
    _objId: string,
    direction: ResizeDirection,
    state: ReturnType<typeof useCanvasStore.getState>,
  ) {
    const selectedObjs = state.objects.filter((o) => state.selectedIds.has(o.id) && !o.locked);
    if (selectedObjs.length === 0) return;

    const prevSnapshots = selectedObjs.map((o) => ({ ...o }));

    // Compute bounding box of all selected objects
    const bboxLeft = Math.min(...selectedObjs.map((o) => o.x));
    const bboxTop = Math.min(...selectedObjs.map((o) => o.y));
    const bboxRight = Math.max(...selectedObjs.map((o) => o.x + o.width));
    const bboxBottom = Math.max(...selectedObjs.map((o) => o.y + o.height));
    const bboxW = bboxRight - bboxLeft;
    const bboxH = bboxBottom - bboxTop;

    if (bboxW === 0 || bboxH === 0) return;

    // Store each object's rect relative to the bounding box (0–1 normalised)
    const relativeRects = selectedObjs.map((o) => ({
      id: o.id,
      rx: (o.x - bboxLeft) / bboxW,
      ry: (o.y - bboxTop) / bboxH,
      rw: o.width / bboxW,
      rh: o.height / bboxH,
    }));

    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (me: PointerEvent) => {
      const zoom = useCanvasStore.getState().camera.zoom;
      const dx = (me.clientX - startX) / zoom;
      const dy = (me.clientY - startY) / zoom;

      // Compute new bounding box dimensions based on direction
      let newBboxX = bboxLeft;
      let newBboxY = bboxTop;
      let newBboxW = bboxW;
      let newBboxH = bboxH;

      if (direction.includes('e')) newBboxW = bboxW + dx;
      if (direction.includes('w')) { newBboxW = bboxW - dx; newBboxX = bboxLeft + dx; }
      if (direction.includes('s')) newBboxH = bboxH + dy;
      if (direction.includes('n')) { newBboxH = bboxH - dy; newBboxY = bboxTop + dy; }

      // Enforce minimum: each object must be at least MIN_WIDTH x MIN_HEIGHT.
      // In practice, clamp the bbox so the scale doesn't go too small.
      const minScaleX = MIN_WIDTH / Math.max(...selectedObjs.map((o) => o.width));
      const minScaleY = MIN_HEIGHT / Math.max(...selectedObjs.map((o) => o.height));
      if (newBboxW / bboxW < minScaleX) {
        newBboxW = bboxW * minScaleX;
        if (direction.includes('w')) newBboxX = bboxLeft + bboxW - newBboxW;
      }
      if (newBboxH / bboxH < minScaleY) {
        newBboxH = bboxH * minScaleY;
        if (direction.includes('n')) newBboxY = bboxTop + bboxH - newBboxH;
      }

      // Update all selected objects
      const dirty = new Set(useCanvasStore.getState().dirtyObjectIds);
      const ids = new Set(relativeRects.map((r) => r.id));

      useCanvasStore.setState((s) => ({
        objects: s.objects.map((o) => {
          if (!ids.has(o.id)) return o;
          const rel = relativeRects.find((r) => r.id === o.id)!;
          return {
            ...o,
            x: newBboxX + rel.rx * newBboxW,
            y: newBboxY + rel.ry * newBboxH,
            width: Math.max(MIN_WIDTH, rel.rw * newBboxW),
            height: Math.max(MIN_HEIGHT, rel.rh * newBboxH),
          };
        }),
        dirtyObjectIds: (() => { ids.forEach((id) => dirty.add(id)); return dirty; })(),
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizing(false);

      // Build undo entry for all affected objects
      const currentObjects = useCanvasStore.getState().objects;
      const redoSnapshots = prevSnapshots
        .map((prev) => currentObjects.find((o) => o.id === prev.id))
        .filter((o): o is CanvasObject => o !== undefined)
        .map((o) => ({ ...o }));

      if (redoSnapshots.length > 0) {
        useCanvasStore.setState((s) => ({
          undoStack: [
            ...s.undoStack,
            { undo: prevSnapshots, redo: redoSnapshots },
          ],
          redoStack: [],
        }));
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return { onPointerDown, resizing };
}
