import { create } from 'zustand';
import type { Board } from '../types';
import * as boardsDb from '../db/boards';
import { pickDirectory } from '../db/filesystem';

interface BoardListState {
  boards: Board[];
  loading: boolean;
  loadBoards: () => Promise<void>;
  createBoard: (title: string) => Promise<Board>;
  createBoardInFolder: (title: string) => Promise<Board>;
  openFromFolder: () => Promise<Board | undefined>;
  deleteBoard: (id: string) => Promise<void>;
  duplicateBoard: (id: string) => Promise<Board | undefined>;
  renameBoard: (id: string, title: string) => Promise<void>;
}

export const useBoardListStore = create<BoardListState>((set) => ({
  boards: [],
  loading: true,

  loadBoards: async () => {
    set({ loading: true });
    const boards = await boardsDb.getAllBoards();
    set({ boards, loading: false });
  },

  createBoard: async (title: string) => {
    const board = await boardsDb.createBoard(title);
    set((s) => ({ boards: [board, ...s.boards] }));
    return board;
  },

  createBoardInFolder: async (title: string) => {
    const handleOrPath = await pickDirectory();
    const board = await boardsDb.createBoard(title, handleOrPath);
    set((s) => ({ boards: [board, ...s.boards] }));
    return board;
  },

  openFromFolder: async () => {
    const handleOrPath = await pickDirectory();
    const board = await boardsDb.createBoardFromFolder(handleOrPath);
    // Update the board list: replace if already present, otherwise prepend
    set((s) => {
      const idx = s.boards.findIndex((b) => b.id === board.id);
      if (idx >= 0) {
        const updated = [...s.boards];
        updated[idx] = board;
        return { boards: updated };
      }
      return { boards: [board, ...s.boards] };
    });
    return board;
  },

  deleteBoard: async (id: string) => {
    await boardsDb.deleteBoard(id);
    set((s) => ({ boards: s.boards.filter((b) => b.id !== id) }));
  },

  duplicateBoard: async (id: string) => {
    const board = await boardsDb.duplicateBoard(id);
    if (board) {
      set((s) => ({ boards: [board, ...s.boards] }));
    }
    return board;
  },

  renameBoard: async (id: string, title: string) => {
    await boardsDb.updateBoard(id, { title });
    set((s) => ({
      boards: s.boards.map((b) => (b.id === id ? { ...b, title, modifiedAt: Date.now() } : b)),
    }));
  },
}));
