import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoardListStore } from '../../stores/boardListStore';
import { BoardCard } from './BoardCard';
import styles from './HomeView.module.css';

export function HomeView() {
  const { boards, loading, loadBoards, createBoard, createBoardInFolder, openFromFolder } = useBoardListStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleCreate = async () => {
    const board = await createBoard('Untitled Board');
    navigate(`/board/${board.id}`);
  };

  const handleCreateInFolder = async () => {
    try {
      const board = await createBoardInFolder('Untitled Board');
      navigate(`/board/${board.id}`);
    } catch {
      // User cancelled the directory picker
    }
  };

  const handleOpenFromFolder = async () => {
    try {
      const board = await openFromFolder();
      if (board) navigate(`/board/${board.id}`);
    } catch {
      // User cancelled or folder read failed
    }
  };

  const count = boards.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Boards</h1>
          {!loading && count > 0 && (
            <p className={styles.subtitle}>{count} board{count !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className={styles.btnGroup}>
          <button className={styles.createBtn} onClick={handleCreate}>
            <span className={styles.createIcon}>+</span>
            New Board
          </button>
          <button className={styles.folderBtn} onClick={handleCreateInFolder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            New in Folder
          </button>
          <button className={styles.folderBtn} onClick={handleOpenFromFolder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <polyline points="12 13 12 17" />
              <polyline points="9 10 12 7 15 10" />
            </svg>
            Open from Folder
          </button>
        </div>
      </header>
      <div className={styles.grid}>
        {loading ? null : boards.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            <p className={styles.emptyTitle}>No boards yet</p>
            <p className={styles.emptyDesc}>Create your first board to start organising.</p>
          </div>
        ) : (
          boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))
        )}
      </div>
    </div>
  );
}
