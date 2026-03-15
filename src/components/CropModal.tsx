import { useState, useEffect, useRef, useCallback } from 'react';
import { getFile } from '../db/objects';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  fileId: string;
  initialCropX: number;
  initialCropY: number;
  initialCropWidth: number;
  initialCropHeight: number;
  onConfirm: (crop: { cropX: number; cropY: number; cropWidth: number; cropHeight: number }) => void;
  onCancel: () => void;
}

const MIN_SIZE = 0.05; // 5% minimum crop size

export function CropModal({ fileId, initialCropX, initialCropY, initialCropWidth, initialCropHeight, onConfirm, onCancel }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: initialCropX, y: initialCropY, width: initialCropWidth, height: initialCropHeight });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; startCrop: CropRect } | null>(null);

  // Load image
  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const file = await getFile(fileId);
      if (file) {
        url = URL.createObjectURL(file.blob);
        setImgUrl(url);
      }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [fileId]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  // Get the displayed image rect within the container
  const getDisplayRect = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imgSize) return null;
    const maxW = window.innerWidth * 0.9;
    const maxH = window.innerHeight * 0.7;
    const scale = Math.min(maxW / imgSize.w, maxH / imgSize.h, 1);
    const dw = imgSize.w * scale;
    const dh = imgSize.h * scale;
    return { width: dw, height: dh };
  }, [imgSize]);

  const clampCrop = useCallback((c: CropRect): CropRect => {
    let { x, y, width, height } = c;
    width = Math.max(MIN_SIZE, Math.min(1, width));
    height = Math.max(MIN_SIZE, Math.min(1, height));
    x = Math.max(0, Math.min(1 - width, x));
    y = Math.max(0, Math.min(1 - height, y));
    return { x, y, width, height };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  }, [crop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const disp = getDisplayRect();
    if (!disp) return;

    const dx = (e.clientX - dragRef.current.startX) / disp.width;
    const dy = (e.clientY - dragRef.current.startY) / disp.height;
    const sc = dragRef.current.startCrop;

    let next: CropRect;

    switch (dragRef.current.type) {
      case 'move':
        next = clampCrop({ x: sc.x + dx, y: sc.y + dy, width: sc.width, height: sc.height });
        break;
      case 'nw':
        next = clampCrop({ x: sc.x + dx, y: sc.y + dy, width: sc.width - dx, height: sc.height - dy });
        break;
      case 'ne':
        next = clampCrop({ x: sc.x, y: sc.y + dy, width: sc.width + dx, height: sc.height - dy });
        break;
      case 'sw':
        next = clampCrop({ x: sc.x + dx, y: sc.y, width: sc.width - dx, height: sc.height + dy });
        break;
      case 'se':
        next = clampCrop({ x: sc.x, y: sc.y, width: sc.width + dx, height: sc.height + dy });
        break;
      default:
        return;
    }

    setCrop(next);
  }, [clampCrop, getDisplayRect]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ cropX: crop.x, cropY: crop.y, cropWidth: crop.width, cropHeight: crop.height });
  }, [crop, onConfirm]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
  }, []);

  if (!imgUrl) return null;

  const disp = getDisplayRect();

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
  };

  const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: 14,
    height: 14,
    background: '#fff',
    border: '2px solid var(--accent, #5B7B9A)',
    borderRadius: 3,
    cursor,
    zIndex: 2,
  });

  const buttonBase: React.CSSProperties = {
    padding: '8px 20px',
    borderRadius: 10,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: 'relative', userSelect: 'none' }}
      >
        <img
          src={imgUrl}
          alt=""
          onLoad={handleImageLoad}
          style={{
            maxWidth: '90vw',
            maxHeight: '70vh',
            objectFit: 'contain',
            display: 'block',
            borderRadius: 4,
          }}
          draggable={false}
        />

        {disp && (
          <>
            {/* Dark overlays outside crop region */}
            {/* Top */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${crop.y * 100}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            {/* Bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${(1 - crop.y - crop.height) * 100}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            {/* Left */}
            <div style={{ position: 'absolute', top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.height * 100}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            {/* Right */}
            <div style={{ position: 'absolute', top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.width) * 100}%`, height: `${crop.height * 100}%`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />

            {/* Crop region (draggable) */}
            <div
              style={{
                position: 'absolute',
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
                border: '2px solid #fff',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                cursor: 'move',
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Corner handles */}
              <div style={{ ...handleStyle('nw-resize'), top: -7, left: -7 }} onPointerDown={(e) => handlePointerDown(e, 'nw')} />
              <div style={{ ...handleStyle('ne-resize'), top: -7, right: -7 }} onPointerDown={(e) => handlePointerDown(e, 'ne')} />
              <div style={{ ...handleStyle('sw-resize'), bottom: -7, left: -7 }} onPointerDown={(e) => handlePointerDown(e, 'sw')} />
              <div style={{ ...handleStyle('se-resize'), bottom: -7, right: -7 }} onPointerDown={(e) => handlePointerDown(e, 'se')} />
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleReset}
          style={{ ...buttonBase, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
        >
          Reset
        </button>
        <button
          onClick={onCancel}
          style={{ ...buttonBase, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          style={{ ...buttonBase, background: 'var(--accent, #5B7B9A)', color: '#fff' }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
