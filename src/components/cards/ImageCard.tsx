import { useState, useEffect } from 'react';
import { getFile } from '../../db/objects';
import type { ImageCard as ImageCardType } from '../../types';

interface Props {
  obj: ImageCardType;
  selected?: boolean;
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const hasPath = u.pathname && u.pathname !== '/';
    const hasQuery = u.search.length > 0;
    if (!hasPath && !hasQuery) return host;
    return host + '/...';
  } catch {
    if (url.length > 40) return url.slice(0, 37) + '...';
    return url;
  }
}

export function ImageCard({ obj, selected }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  // Always load thumbnail
  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const file = await getFile(obj.fileId);
      if (file) {
        url = URL.createObjectURL(file.thumbnailBlob || file.blob);
        setThumbUrl(url);
      }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [obj.fileId]);

  // Load full-res only when selected
  useEffect(() => {
    if (!selected) {
      if (fullUrl) { URL.revokeObjectURL(fullUrl); setFullUrl(null); }
      return;
    }
    let url: string | null = null;
    (async () => {
      const file = await getFile(obj.fileId);
      if (file && file.thumbnailBlob) {
        url = URL.createObjectURL(file.blob);
        setFullUrl(url);
      }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [obj.fileId, selected]);

  const imgUrl = fullUrl || thumbUrl;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, background: '#f2ede6' }}>
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
          borderTop: '1px solid var(--border)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {obj.caption}
        </div>
      )}
      {/* URL overlay tooltip */}
      {obj.linkUrl && hovered && (
        <div style={{
          position: 'absolute',
          bottom: obj.caption ? 30 : 0,
          left: 0,
          right: 0,
          padding: '5px 8px',
          background: 'rgba(44, 40, 37, 0.8)',
          backdropFilter: 'blur(4px)',
          color: '#faf8f5',
          fontSize: 11,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          pointerEvents: 'none',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncateUrl(obj.linkUrl)}
          </span>
        </div>
      )}
    </div>
  );
}
