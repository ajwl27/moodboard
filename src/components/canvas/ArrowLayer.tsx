import React, { memo, useCallback } from 'react';
import type { Arrow, CanvasObject } from '../../types';
import { useCanvasStore } from '../../stores/canvasStore';
import { nearestEdgePoint } from '../../utils/geometry';

interface Props {
  arrows: CanvasObject[];
}

export const ArrowLayer = memo(function ArrowLayer({ arrows }: Props) {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  return (
    <>
      <defs>
        <marker id="ah-end" markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto">
          <path d="M0 0 L12 4.5 L0 9 Z" fill="currentColor" />
        </marker>
        <marker id="ah-start" markerWidth="12" markerHeight="9" refX="2" refY="4.5" orient="auto">
          <path d="M12 0 L0 4.5 L12 9 Z" fill="currentColor" />
        </marker>
      </defs>
      {arrows
        .filter((a): a is Arrow => a.type === 'arrow')
        .map((arrow) => (
          <ArrowPath
            key={arrow.id}
            arrow={arrow}
            allObjects={objects}
            selected={selectedIds.has(arrow.id)}
          />
        ))}
    </>
  );
});

function ArrowPath({
  arrow,
  allObjects,
  selected,
}: {
  arrow: Arrow;
  allObjects: CanvasObject[];
  selected: boolean;
}) {
  let sx = arrow.startX;
  let sy = arrow.startY;
  let ex = arrow.endX;
  let ey = arrow.endY;

  if (arrow.startObjectId) {
    const obj = allObjects.find((o) => o.id === arrow.startObjectId);
    if (obj) {
      const endObj = arrow.endObjectId ? allObjects.find((o) => o.id === arrow.endObjectId) : null;
      const target = endObj
        ? { x: endObj.x + endObj.width / 2, y: endObj.y + endObj.height / 2 }
        : { x: ex, y: ey };
      const pt = nearestEdgePoint({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, target);
      sx = pt.x;
      sy = pt.y;
    }
  }

  if (arrow.endObjectId) {
    const obj = allObjects.find((o) => o.id === arrow.endObjectId);
    if (obj) {
      const pt = nearestEdgePoint({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, { x: sx, y: sy });
      ex = pt.x;
      ey = pt.y;
    }
  }

  // Build SVG path
  let d: string;
  if (arrow.curvature === 0) {
    d = `M ${sx} ${sy} L ${ex} ${ey}`;
  } else {
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const dx = ex - sx;
    const dy = ey - sy;
    const cx = mx - dy * arrow.curvature * 0.5;
    const cy = my + dx * arrow.curvature * 0.5;
    d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  }

  const dashArray =
    arrow.lineStyle === 'dashed' ? '8 4' : arrow.lineStyle === 'dotted' ? '3 5' : undefined;
  const markerEnd = (arrow.arrowHead === 'end' || arrow.arrowHead === 'both') ? 'url(#ah-end)' : undefined;
  const markerStart = arrow.arrowHead === 'both' ? 'url(#ah-start)' : undefined;
  const colour = arrow.colour || '#64748b';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useCanvasStore.getState();
    if (e.shiftKey) store.toggleSelect(arrow.id);
    else store.select(arrow.id);
  }, [arrow.id]);

  // --- Drag whole arrow (translate both endpoints) ---
  const handleBodyPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const store = useCanvasStore.getState();
    if (e.shiftKey) store.toggleSelect(arrow.id);
    else if (!store.selectedIds.has(arrow.id)) store.select(arrow.id);

    const prevArrow = { ...arrow };
    const startScreenX = e.clientX;
    const startScreenY = e.clientY;

    const onMove = (me: PointerEvent) => {
      const zoom = useCanvasStore.getState().camera.zoom;
      const dx = (me.clientX - startScreenX) / zoom;
      const dy = (me.clientY - startScreenY) / zoom;
      useCanvasStore.setState((s) => ({
        objects: s.objects.map((o) =>
          o.id === arrow.id
            ? {
                ...o,
                x: prevArrow.x + dx,
                y: prevArrow.y + dy,
                startX: prevArrow.startX + dx,
                startY: prevArrow.startY + dy,
                endX: prevArrow.endX + dx,
                endY: prevArrow.endY + dy,
                // Detach from objects when manually moved
                startObjectId: null,
                endObjectId: null,
              }
            : o,
        ),
        dirtyObjectIds: new Set(s.dirtyObjectIds).add(arrow.id),
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const current = useCanvasStore.getState().objects.find((o) => o.id === arrow.id);
      if (current) {
        useCanvasStore.setState((s) => ({
          undoStack: [...s.undoStack, { undo: [prevArrow], redo: [{ ...current }] }],
          redoStack: [],
        }));
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [arrow]);

  // --- Drag an endpoint ---
  const handleEndpointDrag = useCallback((e: React.PointerEvent, which: 'start' | 'end') => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const prevArrow = { ...arrow };
    const onMove = (me: PointerEvent) => {
      const state = useCanvasStore.getState();
      const zoom = state.camera.zoom;
      const container = document.querySelector('[class*="container"]') as HTMLElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = (me.clientX - rect.left) / zoom - state.camera.x;
      const cy = (me.clientY - rect.top) / zoom - state.camera.y;

      const changes: Partial<Arrow> =
        which === 'start'
          ? { startX: cx, startY: cy, startObjectId: null }
          : { endX: cx, endY: cy, endObjectId: null };

      useCanvasStore.setState((s) => ({
        objects: s.objects.map((o) => (o.id === arrow.id ? { ...o, ...changes } as typeof o : o)),
        dirtyObjectIds: new Set(s.dirtyObjectIds).add(arrow.id),
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const current = useCanvasStore.getState().objects.find((o) => o.id === arrow.id);
      if (current) {
        useCanvasStore.setState((s) => ({
          undoStack: [...s.undoStack, { undo: [prevArrow], redo: [{ ...current }] }],
          redoStack: [],
        }));
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [arrow]);

  return (
    <g style={{ color: colour }}>
      {/* Wide invisible hit area for clicking / dragging */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(arrow.strokeWidth + 10, 14)}
        pointerEvents="stroke"
        style={{ cursor: 'move' }}
        onClick={handleClick}
        onPointerDown={handleBodyPointerDown}
      />
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke={selected ? '#3b82f6' : colour}
        strokeWidth={arrow.strokeWidth || 2}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        markerEnd={markerEnd}
        markerStart={markerStart}
        pointerEvents="none"
        style={{ transition: 'stroke 0.15s' }}
      />
      {/* Endpoint handles when selected */}
      {selected && (
        <>
          <circle
            cx={sx}
            cy={sy}
            r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
            pointerEvents="all"
            onPointerDown={(e) => handleEndpointDrag(e, 'start')}
          />
          <circle
            cx={ex}
            cy={ey}
            r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
            pointerEvents="all"
            onPointerDown={(e) => handleEndpointDrag(e, 'end')}
          />
        </>
      )}
    </g>
  );
}
