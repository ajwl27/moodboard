import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { getFile } from '../../db/objects';
import type { ImageCard as ImageCardType } from '../../types';

interface Props {
  obj: ImageCardType;
}

export function ImageCard({ obj }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const file = await getFile(obj.fileId);
      if (file) {
        url = URL.createObjectURL(file.thumbnailBlob || file.blob);
        setImgUrl(url);
      }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [obj.fileId]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useCanvasStore.getState().setLightboxFileId(obj.fileId);
  }, [obj.fileId]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, background: '#f8f9fb' }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={obj.caption || obj.originalFilename}
            style={{
              width: '100%',
              height: '100%',
              objectFit: obj.objectFit,
              display: 'block',
              ...(obj.cropWidth != null && obj.cropWidth < 1 || obj.cropHeight != null && obj.cropHeight < 1 || obj.cropX || obj.cropY
                ? { objectViewBox: `inset(${(obj.cropY ?? 0) * 100}% ${(1 - (obj.cropX ?? 0) - (obj.cropWidth ?? 1)) * 100}% ${(1 - (obj.cropY ?? 0) - (obj.cropHeight ?? 1)) * 100}% ${(obj.cropX ?? 0) * 100}%)` } as React.CSSProperties
                : {}),
            }}
            draggable={false}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>
      {obj.caption && (
        <div style={{
          padding: '6px 10px',
          fontSize: 12,
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {obj.caption}
        </div>
      )}
    </div>
  );
}
