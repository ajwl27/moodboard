import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { clamp } from '../utils/geometry';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const RIGHT_CLICK_THRESHOLD = 5; // px — movement below this counts as a static right-click

export function useCamera(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLDivElement | null>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  boardId: string | null,
  onStaticRightClick?: (x: number, y: number, target: HTMLElement) => void,
) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const cameraStartRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);
  const rightClickRef = useRef<{ x: number; y: number; target: HTMLElement; panned: boolean } | null>(null);

  const applyTransform = useCallback(() => {
    const { camera } = useCanvasStore.getState();
    const translate = `translate(${camera.x}px, ${camera.y}px)`;
    if (canvasRef.current) {
      canvasRef.current.style.zoom = `${camera.zoom}`;
      canvasRef.current.style.transform = translate;
    }
    if (svgRef.current) {
      // SVG doesn't support CSS zoom well — keep using scale() for arrows
      svgRef.current.style.transform = `scale(${camera.zoom}) ${translate}`;
    }
  }, [canvasRef, svgRef]);

  // Helper: zoom toward a screen point
  const zoomToward = useCallback(
    (screenX: number, screenY: number, newZoom: number) => {
      const el = containerRef.current;
      if (!el) return;
      const state = useCanvasStore.getState();
      const rect = el.getBoundingClientRect();
      const sx = screenX - rect.left;
      const sy = screenY - rect.top;
      const oldZoom = state.camera.zoom;
      const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);

      // Keep the canvas point under the cursor fixed
      const canvasX = sx / oldZoom - state.camera.x;
      const canvasY = sy / oldZoom - state.camera.y;
      const newX = -(canvasX - sx / z);
      const newY = -(canvasY - sy / z);

      useCanvasStore.setState({ camera: { x: newX, y: newY, zoom: z }, boardDirty: true });
      applyTransform();
    },
    [containerRef, applyTransform],
  );

  // Store the callback in a ref so the native listener always sees the latest version
  const onStaticRightClickRef = useRef(onStaticRightClick);
  onStaticRightClickRef.current = onStaticRightClick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad) — ctrlKey is synthesised for pinch
        const oldZoom = useCanvasStore.getState().camera.zoom;
        const newZoom = oldZoom * Math.pow(2, -e.deltaY * 0.01);
        zoomToward(e.clientX, e.clientY, newZoom);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 && Math.abs(e.deltaX) > 2) {
        // Trackpad two-finger pan (dominant horizontal component)
        const cam = useCanvasStore.getState().camera;
        useCanvasStore.setState({
          camera: { ...cam, x: cam.x - e.deltaX / cam.zoom, y: cam.y - e.deltaY / cam.zoom },
          boardDirty: true,
        });
        applyTransform();
      } else {
        // Regular mouse scroll wheel → ZOOM
        const oldZoom = useCanvasStore.getState().camera.zoom;
        // Each scroll "notch" (deltaY ~100) zooms ~15%
        const factor = Math.pow(1.15, -e.deltaY / 100);
        const newZoom = oldZoom * factor;
        zoomToward(e.clientX, e.clientY, newZoom);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Right-click pan: allow on canvas objects and background, but not on UI overlays
      const isOnCanvas =
        e.target === el ||
        canvasRef.current?.contains(e.target as Node) ||
        svgRef.current?.contains(e.target as Node);

      const shouldPan =
        e.button === 1 ||
        (e.button === 0 && spaceHeldRef.current) ||
        (e.button === 2 && isOnCanvas);
      if (shouldPan) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        const cam = useCanvasStore.getState().camera;
        cameraStartRef.current = { x: cam.x, y: cam.y };
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';

        if (e.button === 2) {
          rightClickRef.current = {
            x: e.clientX,
            y: e.clientY,
            target: e.target as HTMLElement,
            panned: false,
          };
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;

      // Track whether right-click moved enough to count as a pan
      if (rightClickRef.current && !rightClickRef.current.panned) {
        const sdx = e.clientX - rightClickRef.current.x;
        const sdy = e.clientY - rightClickRef.current.y;
        if (Math.abs(sdx) > RIGHT_CLICK_THRESHOLD || Math.abs(sdy) > RIGHT_CLICK_THRESHOLD) {
          rightClickRef.current.panned = true;
        }
      }

      const zoom = useCanvasStore.getState().camera.zoom;
      const dx = (e.clientX - panStartRef.current.x) / zoom;
      const dy = (e.clientY - panStartRef.current.y) / zoom;
      useCanvasStore.setState({
        camera: { x: cameraStartRef.current.x + dx, y: cameraStartRef.current.y + dy, zoom },
        boardDirty: true,
      });
      applyTransform();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        el.releasePointerCapture(e.pointerId);
        el.style.cursor = '';

        // Static right-click (no pan) → show context menu
        if (rightClickRef.current && !rightClickRef.current.panned && onStaticRightClickRef.current) {
          const { x, y, target } = rightClickRef.current;
          onStaticRightClickRef.current(x, y, target);
        }
        rightClickRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true;
        el.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        if (!isPanningRef.current) el.style.cursor = '';
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [containerRef, canvasRef, svgRef, applyTransform, zoomToward, boardId]);
}
