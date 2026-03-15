import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeUrl, getFaviconUrl } from '../../utils/opengraph';
import type { LinkCard as LinkCardType } from '../../types';

interface Props {
  obj: LinkCardType;
}

export function LinkCard({ obj }: Props) {
  const navigate = useNavigate();
  const [faviconError, setFaviconError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const safeUrl = normalizeUrl(obj.url);

  const openLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (obj.targetBoardId) navigate(`/board/${obj.targetBoardId}`);
    else window.open(safeUrl, '_blank', 'noopener');
  }, [safeUrl, obj.targetBoardId, navigate]);

  const displayUrl = (() => {
    try { return new URL(safeUrl).hostname.replace(/^www\./, ''); } catch { return obj.url; }
  })();

  const faviconSrc = getFaviconUrl(safeUrl, 64);
  const hasThumb = !!obj.thumbnailUrl && !thumbError;
  const displayTitle = obj.title || displayUrl;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: 8,
    }}>
      {/* Inner clickable card — this opens the link, outer box is for dragging */}
      <div
        onClick={openLink}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          flex: 1, minHeight: 0,
          borderRadius: 6,
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
          transition: 'box-shadow 0.15s ease-out, border-color 0.15s ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(91, 123, 154, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-light)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* OG image preview banner */}
        {hasThumb && (
          <div style={{
            width: '100%', flexShrink: 0,
            height: '55%', minHeight: 36, maxHeight: 140,
            overflow: 'hidden',
            background: '#EBE7E1',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <img
              src={obj.thumbnailUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setThumbError(true)}
              draggable={false}
            />
          </div>
        )}

        {/* Text content */}
        <div style={{
          flex: 1, minHeight: 0, padding: '8px 10px',
          display: 'flex', flexDirection: 'column', gap: 3,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}>
              {faviconSrc && !faviconError ? (
                <img
                  src={faviconSrc} alt="" width={16} height={16}
                  style={{ borderRadius: 2 }}
                  onError={() => setFaviconError(true)}
                  draggable={false}
                />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }}>
              {displayTitle}
            </div>
          </div>

          {obj.description && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            }}>
              {obj.description}
            </div>
          )}

          <div style={{
            fontSize: 12, color: 'var(--accent)', fontWeight: 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 'auto',
          }}>
            {displayUrl}
          </div>
        </div>
      </div>
    </div>
  );
}
