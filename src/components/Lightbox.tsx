import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { getFile } from '../db/objects';

export function Lightbox() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const fileId = useCanvasStore((s) => s.lightboxFileId);

  useEffect(() => {
    if (!fileId) {
      setImgUrl(null);
      return;
    }
    let url: string | null = null;
    (async () => {
      const file = await getFile(fileId);
      if (file) {
        url = URL.createObjectURL(file.blob);
        setImgUrl(url);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  const close = useCallback(() => {
    useCanvasStore.getState().setLightboxFileId(null);
  }, []);

  useEffect(() => {
    if (!fileId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fileId, close]);

  if (!fileId || !imgUrl) return null;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        cursor: 'pointer',
      }}
    >
      <img
        src={imgUrl}
        alt=""
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
