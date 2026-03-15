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
        <marker id="ah-end" markerWidth="8" markerHeight="6" refX="7.5" refY="3" orient="auto">
          <path d="M0 0 L8 3 L0 6 Z" fill="currentColor" />
        </marker>
        <marker id="ah-start" markerWidth="8" markerHeight="6" refX="0.5" refY="3" orient="auto">
          <path d="M8 0 L0 3 L8 6 Z" fill="currentColor" />
        </marker>
        <marker id="ah-end-sel" markerWidth="8" markerHeight="6" refX="7.5" refY="3" orient="auto">
          <path d="M0 0 L8 3 L0 6 Z" fill="#5B7B9A" />
        </marker>
        <marker id="ah-start-sel" markerWidth="8" markerHeight="6" refX="0.5" refY="3" orient="auto">
          <path d="M8 0 L0 3 L8 6 Z" fill="#5B7B9A" />
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

  // Build SVG path — always use a subtle curve even for "straight" arrows
  let d: string;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (arrow.curvature === 0 && len > 0) {
    // Apply a subtle default curve (15% perpendicular offset)
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const perpX = -dy / len;
    const perpY = dx / len;
    const offset = len * 0.08;
    const cx = mx + perpX * offset;
    const cy = my + perpY * offset;
    d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  } else if (arrow.curvature !== 0) {
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const cx = mx - dy * arrow.curvature * 0.5;
    const cy = my + dx * arrow.curvature * 0.5;
    d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  } else {
    d = `M ${sx} ${sy} L ${ex} ${ey}`;
  }

  const dashArray =
    arrow.lineStyle === 'dashed' ? '8 4' : arrow.lineStyle === 'dotted' ? '3 5' : undefined;
  const markerEnd = (arrow.arrowHead === 'end' || arrow.arrowHead === 'both')
    ? (selected ? 'url(#ah-end-sel)' : 'url(#ah-end)')
    : undefined;
  const markerStart = arrow.arrowHead === 'both'
    ? (selected ? 'url(#ah-start-sel)' : 'url(#ah-start)')
    : undefined;
  const defaultColour = '#9A9189';
  const colour = arrow.colour || defaultColour;
  const strokeColour = selected ? '#5B7B9A' : colour;
  const strokeW = selected ? (arrow.strokeWidth || 1.5) + 0.5 : (arrow.strokeWidth || 1.5);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useCanvasStore.getState();
    if (e.shiftKey) store.toggleSelect(arrow.id);
    else store.select(arrow.id);
  }, [arrow.id]);

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
      const ddx = (me.clientX - startScreenX) / zoom;
      const ddy = (me.clientY - startScreenY) / zoom;
      useCanvasStore.setState((s) => ({
        objects: s.objects.map((o) =>
          o.id === arrow.id
            ? {
                ...o,
                x: prevArrow.x + ddx,
                y: prevArrow.y + ddy,
                startX: prevArrow.startX + ddx,
                startY: prevArrow.startY + ddy,
                endX: prevArrow.endX + ddx,
                endY: prevArrow.endY + ddy,
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
    <g style={{ color: strokeColour }}>
      {/* Wide invisible hit area */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(strokeW + 10, 14)}
        pointerEvents="stroke"
        style={{ cursor: 'move' }}
        onClick={handleClick}
        onPointerDown={handleBodyPointerDown}
      />
      {/* Origin dot */}
      <circle
        cx={sx}
        cy={sy}
        r={2}
        fill={strokeColour}
        pointerEvents="none"
      />
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke={strokeColour}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        markerEnd={markerEnd}
        markerStart={markerStart}
        pointerEvents="none"
        style={{ transition: 'stroke 0.15s ease-out' }}
      />
      {/* Endpoint handles when selected */}
      {selected && (
        <>
          <circle
            cx={sx}
            cy={sy}
            r={5}
            fill="#faf8f5"
            stroke="#5B7B9A"
            strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            pointerEvents="all"
            onPointerDown={(e) => handleEndpointDrag(e, 'start')}
          />
          <circle
            cx={ex}
            cy={ey}
            r={5}
            fill="#faf8f5"
            stroke="#5B7B9A"
            strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            pointerEvents="all"
            onPointerDown={(e) => handleEndpointDrag(e, 'end')}
          />
        </>
      )}
    </g>
  );
}
