import { useState, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { Arrow, Point } from '../types';

interface ArrowDrawState {
  startPoint: Point | null;
  startObjectId: string | null;
  previewEnd: Point | null;
}

export function useArrowDrawing(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [drawState, setDrawState] = useState<ArrowDrawState>({
    startPoint: null,
    startObjectId: null,
    previewEnd: null,
  });

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

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const state = useCanvasStore.getState();
      if (state.toolMode !== 'arrow') return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);

      // Check if clicking on an object
      const target = e.target as HTMLElement;
      const objectEl = target.closest('[data-object-id]');
      const objectId = objectEl?.getAttribute('data-object-id') ?? null;

      if (!drawState.startPoint) {
        // First click — set start
        setDrawState({
          startPoint: canvasPoint,
          startObjectId: objectId,
          previewEnd: canvasPoint,
        });
      } else {
        // Second click — create arrow
        const arrow: Arrow = {
          id: crypto.randomUUID(),
          boardId: state.boardId!,
          type: 'arrow',
          x: Math.min(drawState.startPoint.x, canvasPoint.x),
          y: Math.min(drawState.startPoint.y, canvasPoint.y),
          width: Math.abs(canvasPoint.x - drawState.startPoint.x) || 1,
          height: Math.abs(canvasPoint.y - drawState.startPoint.y) || 1,
          zIndex: state.getMaxZIndex() + 1,
          locked: false,
          colour: '#666666',
          layerId: state.activeLayerId,
          startX: drawState.startPoint.x,
          startY: drawState.startPoint.y,
          endX: canvasPoint.x,
          endY: canvasPoint.y,
          startObjectId: drawState.startObjectId,
          endObjectId: objectId,
          lineStyle: 'solid',
          arrowHead: 'end',
          curvature: 0,
          strokeWidth: 2,
        };
        state.addObject(arrow);
        setDrawState({ startPoint: null, startObjectId: null, previewEnd: null });
        state.setToolMode('select');
        state.select(arrow.id);
      }
    },
    [drawState, screenToCanvas],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawState.startPoint) return;
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      setDrawState((s) => ({ ...s, previewEnd: canvasPoint }));
    },
    [drawState.startPoint, screenToCanvas],
  );

  return { drawState, handleCanvasClick, handleMouseMove };
}
