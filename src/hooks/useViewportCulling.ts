import { useMemo } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { rectsIntersect } from '../utils/geometry';

const MARGIN = 200; // extra canvas-space pixels to render beyond viewport

export function useViewportCulling(
  containerRef: React.RefObject<HTMLDivElement | null>,
): Set<string> | null {
  const objects = useCanvasStore((s) => s.objects);
  const camera = useCanvasStore((s) => s.camera);

  return useMemo(() => {
    const el = containerRef.current;
    if (!el) return null;

    const vw = el.clientWidth;
    const vh = el.clientHeight;

    const visibleRect = {
      x: -camera.x - MARGIN / camera.zoom,
      y: -camera.y - MARGIN / camera.zoom,
      width: vw / camera.zoom + (MARGIN * 2) / camera.zoom,
      height: vh / camera.zoom + (MARGIN * 2) / camera.zoom,
    };

    const visible = new Set<string>();
    for (const obj of objects) {
      if (rectsIntersect(visibleRect, { x: obj.x, y: obj.y, width: obj.width, height: obj.height })) {
        visible.add(obj.id);
      }
      // Always include arrows connected to visible objects
      if (obj.type === 'arrow') {
        visible.add(obj.id);
      }
    }
    return visible;
  }, [objects, camera, containerRef]);
}
