import { useCallback } from 'react';
import { getFile } from '../../db/objects';
import type { FileCard as FileCardType } from '../../types';
import { getFileIcon } from '../../utils/fileIcons';

interface Props {
  obj: FileCardType;
}

export function FileCard({ obj }: Props) {
  const handleDoubleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const file = await getFile(obj.fileId);
    if (file) {
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
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%', height: '100%', padding: 14,
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'default',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: '#EBE7E1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {getFileIcon(obj.mimeType)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {obj.originalFilename}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {formatSize(obj.fileSize)}
        </div>
      </div>
    </div>
  );
}
