import React, { memo, useCallback, useRef, useEffect } from 'react';
import type { CanvasObject as CanvasObjectType, Layer } from '../../types';
import type { ResizeDirection } from '../../hooks/useResize';
import { useCanvasStore } from '../../stores/canvasStore';
import { TextCard } from '../cards/TextCard';
import { ImageCard } from '../cards/ImageCard';
import { LinkCard } from '../cards/LinkCard';
import { FileCard } from '../cards/FileCard';
import { GroupRegion } from '../cards/GroupRegion';
import { NoteCard } from '../cards/NoteCard';
import { DrawingCard } from '../cards/DrawingCard';

interface Props {
  obj: CanvasObjectType;
  selected: boolean;
  interacting?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizePointerDown: (e: React.PointerEvent, id: string, dir: ResizeDirection) => void;
}

const SHADOW_DEFAULT = '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06)';
const SHADOW_HOVER = '0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.08)';
const SHADOW_SELECTED = '0 0 0 1.5px #5B7B9A, 0 0 0 4.5px rgba(91, 123, 154, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)';

const CLICK_DRAG_THRESHOLD = 4;

export const CanvasObject = memo(function CanvasObject({
  obj,
  selected,
  interacting,
  onPointerDown,
  onResizePointerDown,
}: Props) {
  if (obj.type === 'arrow') return null;

  const innerRef = useRef<HTMLDivElement>(null);
  const layers = useCanvasStore((s) => s.layers);
  const layer: Layer | undefined = obj.layerId ? layers.find((l) => l.id === obj.layerId) : undefined;
  const layerOpacity = layer?.opacity ?? 1;
  const hoverColour = layer?.colour ?? '#5B7B9A';

  // Track pointer position for click vs drag detection
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up click timer on unmount
  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0) {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    }
    onPointerDown(e, obj.id);
  };

  // Single click: open URL for images with linkUrl (with delay for double-click detection)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (obj.type !== 'image' || !obj.linkUrl) return;
    if (!pointerStartRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.abs(dx) > CLICK_DRAG_THRESHOLD || Math.abs(dy) > CLICK_DRAG_THRESHOLD) return;

    // Delay to allow double-click to cancel
    clickTimerRef.current = setTimeout(() => {
      window.open(obj.linkUrl!, '_blank', 'noopener');
    }, 250);
  }, [obj]);

  // Double-click: lightbox for images (cancels URL navigation)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (obj.type === 'image') {
      e.stopPropagation();
      useCanvasStore.getState().setLightboxFileId(obj.fileId);
    }
  }, [obj]);

  const isGroup = obj.type === 'group';
  const isImage = obj.type === 'image';
  const isDrawing = obj.type === 'drawing';
  const isTransparentText = (obj.type === 'text' || obj.type === 'note') && !!(obj as any).transparentBg;
  const hasLink = isImage && !!(obj as any).linkUrl;
  const noCardBg = isGroup || isTransparentText || isDrawing;

  const onEnter = useCallback(() => {
    const el = innerRef.current;
    if (!el || selected) return;
    if (isGroup) {
      el.style.borderColor = hoverColour;
    } else if (!noCardBg) {
      el.style.boxShadow = SHADOW_HOVER;
      if (isImage) {
        el.style.transform = 'scale(1.005)';
      }
    }
  }, [selected, isGroup, isImage, noCardBg, hoverColour]);

  const onLeave = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    if (isGroup) {
      el.style.borderColor = selected ? '#5B7B9A' : (obj.colour || '#E0DBD5');
    } else if (!noCardBg) {
      el.style.boxShadow = selected ? SHADOW_SELECTED : SHADOW_DEFAULT;
      if (isImage) {
        el.style.transform = '';
      }
    }
  }, [selected, isGroup, isImage, noCardBg, obj.colour]);

  // Outer div: positioning, overflow visible (for resize handles), events
  const outerStyle: React.CSSProperties = {
    position: 'absolute',
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex,
    opacity: layerOpacity,
    overflow: 'visible',
    cursor: isDrawing ? 'default'
      : obj.locked || layer?.locked ? 'default'
      : hasLink ? 'pointer' : 'move',
    userSelect: 'none',
    pointerEvents: isDrawing ? 'none' : 'auto',
  };

  // Inner div: visual styles (bg, shadow, border, border-radius, overflow hidden)
  const innerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: isGroup ? 12 : 6,
    overflow: isGroup ? 'visible' : 'hidden',
    background: isGroup
      ? ((obj as any).backgroundColour || 'rgba(91, 123, 154, 0.06)')
      : noCardBg ? 'transparent'
      : (obj.colour || '#faf8f5'),
    boxShadow: noCardBg
      ? (selected ? SHADOW_SELECTED : 'none')
      : selected ? SHADOW_SELECTED : SHADOW_DEFAULT,
    border: isGroup
      ? `2px ${(obj as any).borderStyle || 'dashed'} ${selected ? '#5B7B9A' : (obj.colour || '#E0DBD5')}`
      : 'none',
    transition: 'box-shadow 0.2s ease-out, border-color 0.2s ease-out, transform 0.2s ease-out, filter 0.15s ease-out',
    ...(isImage && selected && interacting ? { opacity: 0.5 } : {}),
  };

  let content: React.ReactNode;
  switch (obj.type) {
    case 'text':
      content = <TextCard obj={obj} />;
      break;
    case 'image':
      content = <ImageCard obj={obj} selected={selected} />;
      break;
    case 'link':
      content = <LinkCard obj={obj} />;
      break;
    case 'file':
      content = <FileCard obj={obj} />;
      break;
    case 'group':
      content = <GroupRegion obj={obj} />;
      break;
    case 'note':
      content = <NoteCard obj={obj} />;
      break;
    case 'drawing':
      content = <DrawingCard obj={obj} />;
      break;
  }

  return (
    <div
      style={outerStyle}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-object-id={obj.id}
    >
      <div ref={innerRef} style={innerStyle}>
        {content}
      </div>
      {selected && !obj.locked && !layer?.locked && (
        <ResizeHandles objId={obj.id} onPointerDown={onResizePointerDown} />
      )}
    </div>
  );
});

const handlePositions: Array<{ dir: ResizeDirection; style: React.CSSProperties }> = [
  { dir: 'nw', style: { top: -6, left: -6, cursor: 'nwse-resize' } },
  { dir: 'n', style: { top: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'ne', style: { top: -6, right: -6, cursor: 'nesw-resize' } },
  { dir: 'e', style: { top: '50%', right: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  { dir: 'se', style: { bottom: -6, right: -6, cursor: 'nwse-resize' } },
  { dir: 's', style: { bottom: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'sw', style: { bottom: -6, left: -6, cursor: 'nesw-resize' } },
  { dir: 'w', style: { top: '50%', left: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
];

function ResizeHandles({
  objId,
  onPointerDown,
}: {
  objId: string;
  onPointerDown: (e: React.PointerEvent, id: string, dir: ResizeDirection) => void;
}) {
  return (
    <>
      {handlePositions.map(({ dir, style }) => (
        <div
          key={dir}
          onPointerDown={(e) => onPointerDown(e, objId, dir)}
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            background: '#faf8f5',
            border: '1.5px solid #5B7B9A',
            borderRadius: 2,
            zIndex: 9999,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            ...style,
          }}
        />
      ))}
    </>
  );
}
