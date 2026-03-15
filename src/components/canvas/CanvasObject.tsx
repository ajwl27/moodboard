import React, { memo, useCallback, useRef } from 'react';
import type { CanvasObject as CanvasObjectType, Layer } from '../../types';
import type { ResizeDirection } from '../../hooks/useResize';
import { useCanvasStore } from '../../stores/canvasStore';
import { hexToRgba } from '../../utils/colours';
import { TextCard } from '../cards/TextCard';
import { ImageCard } from '../cards/ImageCard';
import { LinkCard } from '../cards/LinkCard';
import { FileCard } from '../cards/FileCard';
import { GroupRegion } from '../cards/GroupRegion';

interface Props {
  obj: CanvasObjectType;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizePointerDown: (e: React.PointerEvent, id: string, dir: ResizeDirection) => void;
}

// Shadows / border colours
const SHADOW_DEFAULT = '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)';
const SHADOW_HOVER = '0 3px 12px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06)';
const SHADOW_SELECTED = '0 0 0 2px #6366f1, 0 4px 20px rgba(99, 102, 241, 0.15)';

export const CanvasObject = memo(function CanvasObject({
  obj,
  selected,
  onPointerDown,
  onResizePointerDown,
}: Props) {
  if (obj.type === 'arrow') return null;

  const divRef = useRef<HTMLDivElement>(null);
  const layers = useCanvasStore((s) => s.layers);
  const layer: Layer | undefined = obj.layerId ? layers.find((l) => l.id === obj.layerId) : undefined;
  const layerOpacity = layer?.opacity ?? 1;
  const hoverColour = layer?.colour ?? '#6366f1';

  const handlePointerDown = (e: React.PointerEvent) => {
    onPointerDown(e, obj.id);
  };

  const isGroup = obj.type === 'group';
  const isImage = obj.type === 'image';

  // Hover: layer-coloured border + lift shadow + tint for non-image cards
  const onEnter = useCallback(() => {
    const el = divRef.current;
    if (!el || selected) return;
    if (isGroup) {
      el.style.borderColor = hoverColour;
    } else {
      el.style.boxShadow = `0 0 0 2px ${hexToRgba(hoverColour, 0.5)}, ${SHADOW_HOVER}`;
    }
    if (!isImage && !isGroup) {
      el.style.filter = 'brightness(0.97)';
    }
  }, [selected, isGroup, isImage, hoverColour]);

  const onLeave = useCallback(() => {
    const el = divRef.current;
    if (!el) return;
    if (isGroup) {
      el.style.borderColor = selected ? '#6366f1' : (obj.colour || '#cbd5e1');
    } else {
      el.style.boxShadow = selected ? SHADOW_SELECTED : SHADOW_DEFAULT;
    }
    el.style.filter = '';
  }, [selected, isGroup, obj.colour]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex,
    opacity: layerOpacity,
    borderRadius: isGroup ? 12 : 10,
    overflow: isGroup ? 'visible' : 'hidden',
    cursor: obj.locked || layer?.locked ? 'default' : 'move',
    userSelect: 'none',
    background: isGroup
      ? ((obj as any).backgroundColour || 'rgba(99, 102, 241, 0.06)')
      : (obj.colour || '#ffffff'),
    boxShadow: isGroup
      ? 'none'
      : selected ? SHADOW_SELECTED : SHADOW_DEFAULT,
    border: isGroup
      ? `2px ${(obj as any).borderStyle || 'dashed'} ${selected ? '#6366f1' : (obj.colour || '#cbd5e1')}`
      : 'none',
    transition: 'box-shadow 0.15s, border-color 0.15s, filter 0.15s',
  };

  let content: React.ReactNode;
  switch (obj.type) {
    case 'text':
      content = <TextCard obj={obj} />;
      break;
    case 'image':
      content = <ImageCard obj={obj} />;
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
  }

  return (
    <div
      ref={divRef}
      style={style}
      onPointerDown={handlePointerDown}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-object-id={obj.id}
    >
      {content}
      {selected && !obj.locked && !layer?.locked && (
        <ResizeHandles objId={obj.id} onPointerDown={onResizePointerDown} />
      )}
    </div>
  );
});

const handlePositions: Array<{ dir: ResizeDirection; style: React.CSSProperties }> = [
  { dir: 'nw', style: { top: -5, left: -5, cursor: 'nwse-resize' } },
  { dir: 'n', style: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'ne', style: { top: -5, right: -5, cursor: 'nesw-resize' } },
  { dir: 'e', style: { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  { dir: 'se', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
  { dir: 's', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'sw', style: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
  { dir: 'w', style: { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
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
            width: 10,
            height: 10,
            background: 'white',
            border: '2px solid #6366f1',
            borderRadius: 3,
            zIndex: 9999,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            ...style,
          }}
        />
      ))}
    </>
  );
}
