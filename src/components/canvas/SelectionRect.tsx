import type { Rect } from '../../types';

export function SelectionRect({ rect }: { rect: Rect }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        border: '1px solid #5B7B9A',
        background: 'rgba(91, 123, 154, 0.08)',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
}
