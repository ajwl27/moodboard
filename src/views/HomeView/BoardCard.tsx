import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Board } from '../../types';
import { useBoardListStore } from '../../stores/boardListStore';
import styles from './BoardCard.module.css';

interface BoardCardProps {
  board: Board;
}

export function BoardCard({ board }: BoardCardProps) {
  const navigate = useNavigate();
  const { renameBoard, deleteBoard, duplicateBoard } = useBoardListStore();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(board.title);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manage thumbnail URL lifecycle to prevent memory leaks
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!board.thumbnail) { setThumbnailUrl(null); return; }
    const url = URL.createObjectURL(board.thumbnail);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [board.thumbnail]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const handleClick = () => {
    if (!editing && !contextMenu) {
      navigate(`/board/${board.id}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const commitRename = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== board.title) {
      await renameBoard(board.id, trimmed);
    } else {
      setEditValue(board.title);
    }
    setEditing(false);
  }, [editValue, board.title, board.id, renameBoard]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setEditValue(board.title);
      setEditing(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className={styles.card} onClick={handleClick} onContextMenu={handleContextMenu}>
        <div className={styles.thumbnail}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" />
          ) : (
            <svg className={styles.thumbnailIcon} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <rect x="7" y="7" width="4" height="4" rx="1" />
              <rect x="13" y="7" width="4" height="2" rx="1" />
              <rect x="7" y="13" width="10" height="4" rx="1" />
            </svg>
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.titleRow}>
            {editing ? (
              <input
                ref={inputRef}
                className={styles.nameInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={styles.name}>{board.title}</span>
            )}
          </div>
          <p className={styles.date}>{formatDate(board.modifiedAt)}</p>
          {board.folderName && (
            <p className={styles.folder}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {board.folderName}
            </p>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.menuItem}
            onClick={() => { setContextMenu(null); setEditing(true); setEditValue(board.title); }}
          >
            Rename
          </button>
          <button
            className={styles.menuItem}
            onClick={async () => { setContextMenu(null); await duplicateBoard(board.id); }}
          >
            Duplicate
          </button>
          <button
            className={styles.menuItemDanger}
            onClick={async () => { setContextMenu(null); await deleteBoard(board.id); }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
