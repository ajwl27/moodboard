import React, { memo, useCallback, useRef } from 'react';
import type { CanvasObject as CanvasObjectType, Layer } from '../../types';
import type { ResizeDirection } from '../../hooks/useResize';
import { useCanvasStore } from '../../stores/canvasStore';
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

const SHADOW_DEFAULT = '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06)';
const SHADOW_HOVER = '0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.08)';
const SHADOW_SELECTED = '0 0 0 1.5px #5B7B9A, 0 0 0 4.5px rgba(91, 123, 154, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)';

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
  const hoverColour = layer?.colour ?? '#5B7B9A';

  const handlePointerDown = (e: React.PointerEvent) => {
    onPointerDown(e, obj.id);
  };

  const isGroup = obj.type === 'group';
  const isImage = obj.type === 'image';

  const onEnter = useCallback(() => {
    const el = divRef.current;
    if (!el || selected) return;
    if (isGroup) {
      el.style.borderColor = hoverColour;
    } else {
      el.style.boxShadow = SHADOW_HOVER;
      if (isImage) {
        el.style.transform = 'scale(1.005)';
      }
    }
  }, [selected, isGroup, isImage, hoverColour]);

  const onLeave = useCallback(() => {
    const el = divRef.current;
    if (!el) return;
    if (isGroup) {
      el.style.borderColor = selected ? '#5B7B9A' : (obj.colour || '#E0DBD5');
    } else {
      el.style.boxShadow = selected ? SHADOW_SELECTED : SHADOW_DEFAULT;
      if (isImage) {
        el.style.transform = '';
      }
    }
  }, [selected, isGroup, isImage, obj.colour]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex,
    opacity: layerOpacity,
    borderRadius: isGroup ? 12 : 6,
    overflow: isGroup ? 'visible' : 'hidden',
    cursor: obj.locked || layer?.locked ? 'default' : 'move',
    userSelect: 'none',
    background: isGroup
      ? ((obj as any).backgroundColour || 'rgba(91, 123, 154, 0.06)')
      : (obj.colour || '#faf8f5'),
    boxShadow: isGroup
      ? 'none'
      : selected ? SHADOW_SELECTED : SHADOW_DEFAULT,
    border: isGroup
      ? `2px ${(obj as any).borderStyle || 'dashed'} ${selected ? '#5B7B9A' : (obj.colour || '#E0DBD5')}`
      : 'none',
    transition: 'box-shadow 0.2s ease-out, border-color 0.2s ease-out, transform 0.2s ease-out',
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
  { dir: 'nw', style: { top: -4, left: -4, cursor: 'nwse-resize' } },
  { dir: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'ne', style: { top: -4, right: -4, cursor: 'nesw-resize' } },
  { dir: 'e', style: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  { dir: 'se', style: { bottom: -4, right: -4, cursor: 'nwse-resize' } },
  { dir: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'sw', style: { bottom: -4, left: -4, cursor: 'nesw-resize' } },
  { dir: 'w', style: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
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
            width: 8,
            height: 8,
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
