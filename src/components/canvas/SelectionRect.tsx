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
        border: '1px solid #2563eb',
        background: 'rgba(37, 99, 235, 0.08)',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
}
