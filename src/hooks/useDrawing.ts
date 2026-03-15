import { useState, useCallback, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { DrawingCard, Point } from '../types';

interface DrawState {
  isDrawing: boolean;
  points: Point[];
}

export function useDrawing(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [drawState, setDrawState] = useState<DrawState>({
    isDrawing: false,
    points: [],
  });
  const pointsRef = useRef<Point[]>([]);
  const countRef = useRef(0);

  const screenToCanvas = useCallback(
    (sx: number, sy: number): Point => {
      const el = containerRef.current!;
      const rect = el.getBoundingClientRect();
      const cam = useCanvasStore.getState().camera;
      return {
        x: (sx - rect.left) / cam.zoom - cam.x,
        y: (sy - rect.top) / cam.zoom - cam.y,
      };
    },
    [containerRef],
  );

  const eraseAt = useCallback((canvasPoint: Point) => {
    const state = useCanvasStore.getState();
    const eraserRadius = Math.max(state.drawBrushSize / 2, 4);
    const drawings = state.objects.filter((o) => o.type === 'drawing') as DrawingCard[];

    const toRemove: string[] = [];
    const toAdd: DrawingCard[] = [];

    for (const d of drawings) {
      // Quick bounding box check first
      if (
        canvasPoint.x < d.x - eraserRadius ||
        canvasPoint.x > d.x + d.width + eraserRadius ||
        canvasPoint.y < d.y - eraserRadius ||
        canvasPoint.y > d.y + d.height + eraserRadius
      ) {
        continue;
      }

      // Convert relative points to absolute
      const absPoints = d.points.map((p) => ({
        x: d.x + p.x * d.width,
        y: d.y + p.y * d.height,
      }));

      // Check which points are within the eraser radius
      const erased = absPoints.map((p) => {
        const dx = p.x - canvasPoint.x;
        const dy = p.y - canvasPoint.y;
        return dx * dx + dy * dy <= eraserRadius * eraserRadius;
      });

      // If no points were erased, skip
      if (!erased.some(Boolean)) continue;

      // If all points erased, just remove the whole drawing
      if (erased.every(Boolean)) {
        toRemove.push(d.id);
        continue;
      }

      // Split into contiguous segments of non-erased points
      toRemove.push(d.id);
      const segments: Point[][] = [];
      let current: Point[] = [];

      for (let i = 0; i < absPoints.length; i++) {
        if (!erased[i]) {
          current.push(absPoints[i]);
        } else {
          if (current.length >= 2) {
            segments.push(current);
          }
          current = [];
        }
      }
      if (current.length >= 2) {
        segments.push(current);
      }

      // Create new drawing objects for each remaining segment
      for (const seg of segments) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of seg) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        const pad = 10;
        const w = Math.max(maxX - minX, 2) + pad * 2;
        const h = Math.max(maxY - minY, 2) + pad * 2;
        const bx = minX - pad;
        const by = minY - pad;

        const normalized = seg.map((p) => ({
          x: (p.x - bx) / w,
          y: (p.y - by) / h,
        }));

        toAdd.push({
          id: crypto.randomUUID(),
          boardId: d.boardId,
          type: 'drawing',
          x: bx,
          y: by,
          width: w,
          height: h,
          zIndex: d.zIndex,
          locked: false,
          colour: 'transparent',
          layerId: d.layerId,
          points: normalized,
          strokeColour: d.strokeColour,
          strokeWidth: d.strokeWidth,
        });
      }
    }

    if (toRemove.length > 0) {
      state.removeObjects(toRemove);
    }
    if (toAdd.length > 0) {
      state.addObjects(toAdd);
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const state = useCanvasStore.getState();
      if (state.toolMode !== 'draw' || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const pt = screenToCanvas(e.clientX, e.clientY);

      if (state.drawIsEraser) {
        eraseAt(pt);
        setDrawState({ isDrawing: true, points: [pt] });
        return;
      }

      pointsRef.current = [pt];
      countRef.current = 0;
      setDrawState({ isDrawing: true, points: [pt] });
    },
    [screenToCanvas, eraseAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawState.isDrawing) return;

      const state = useCanvasStore.getState();
      const pt = screenToCanvas(e.clientX, e.clientY);

      if (state.drawIsEraser) {
        eraseAt(pt);
        setDrawState({ isDrawing: true, points: [pt] });
        return;
      }

      pointsRef.current.push(pt);
      countRef.current++;

      // Throttle state updates (every 3rd point) for performance
      if (countRef.current % 3 === 0) {
        setDrawState({ isDrawing: true, points: [...pointsRef.current] });
      }
    },
    [drawState.isDrawing, screenToCanvas, eraseAt],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (!drawState.isDrawing) return;

      const state = useCanvasStore.getState();

      // If eraser mode, just stop
      if (state.drawIsEraser) {
        setDrawState({ isDrawing: false, points: [] });
        return;
      }

      const allPoints = pointsRef.current;
      if (allPoints.length < 2) {
        setDrawState({ isDrawing: false, points: [] });
        return;
      }

      // Compute bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of allPoints) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }

      // Ensure minimum size
      const pad = 10;
      const width = Math.max(maxX - minX, 2) + pad * 2;
      const height = Math.max(maxY - minY, 2) + pad * 2;
      const bboxX = minX - pad;
      const bboxY = minY - pad;

      // Normalize points to 0-1 relative coords
      const normalized = allPoints.map((p) => ({
        x: (p.x - bboxX) / width,
        y: (p.y - bboxY) / height,
      }));

      const drawing: DrawingCard = {
        id: crypto.randomUUID(),
        boardId: state.boardId!,
        type: 'drawing',
        x: bboxX,
        y: bboxY,
        width,
        height,
        zIndex: state.getMaxZIndex() + 1,
        locked: false,
        colour: 'transparent',
        layerId: state.activeLayerId,
        points: normalized,
        strokeColour: state.drawBrushColour,
        strokeWidth: state.drawBrushSize,
      };

      state.addObject(drawing);
      setDrawState({ isDrawing: false, points: [] });
      // Stay in draw mode
    },
    [drawState.isDrawing],
  );

  return { drawState, handlePointerDown, handlePointerMove, handlePointerUp };
}
