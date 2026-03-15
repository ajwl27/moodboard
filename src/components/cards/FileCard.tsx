import { useCallback, useState } from 'react';
import { getFile } from '../../db/objects';
import { isTauri } from '../../utils/tauri';
import type { FileCard as FileCardType } from '../../types';
import { getFileIconSvg } from '../../utils/fileIcons';

interface Props {
  obj: FileCardType;
}

export function FileCard({ obj }: Props) {
  const [hovered, setHovered] = useState(false);

  const openFile = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const file = await getFile(obj.fileId);
    if (!file) return;

    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const savePath = await save({
        defaultPath: file.originalFilename,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });
      if (savePath) {
        const buffer = new Uint8Array(await file.blob.arrayBuffer());
        await writeFile(savePath, buffer);
      }
    } else {
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [obj.fileId]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const ext = obj.originalFilename.includes('.')
    ? obj.originalFilename.split('.').pop()!.toUpperCase()
    : '';

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Double-click to open file, single click/drag to move */}
      <div
        onDoubleClick={openFile}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          cursor: 'default',
          transition: 'background 0.12s',
          background: hovered ? 'rgba(91, 123, 154, 0.04)' : 'transparent',
          borderRadius: 4,
        }}
      >
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: hovered ? 'rgba(91, 123, 154, 0.10)' : '#EBE7E1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          color: hovered ? 'var(--accent)' : '#7A7268',
          transition: 'all 0.15s',
        }}>
          {getFileIconSvg(obj.mimeType)}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: hovered ? 'var(--accent)' : 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s',
          }}>
            {obj.originalFilename}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {ext && (
              <span style={{
                background: 'rgba(0,0,0,0.05)', borderRadius: 3,
                padding: '1px 4px', fontSize: 10, fontWeight: 600,
                letterSpacing: '0.3px',
              }}>
                {ext}
              </span>
            )}
            <span>{formatSize(obj.fileSize)}</span>
          </div>
        </div>

        {/* Open indicator */}
        <div style={{
          flexShrink: 0,
          color: hovered ? 'var(--accent)' : 'var(--text-tertiary)',
          opacity: hovered ? 1 : 0.4,
          transition: 'all 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
