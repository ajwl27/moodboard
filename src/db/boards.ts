import { db } from './schema';
import { saveDirHandle, readBoardFromFolder } from './filesystem';
import type { Board, Camera, CanvasObject } from '../types';

const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 };

export async function createBoard(
  title: string,
  dirHandleOrPath?: FileSystemDirectoryHandle | string,
): Promise<Board> {
  const board: Board = {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    camera: defaultCamera,
    layers: [],
  };

  if (dirHandleOrPath) {
    const handleId = crypto.randomUUID();
    await saveDirHandle(handleId, dirHandleOrPath);
    board.dirHandleId = handleId;
    board.folderName = typeof dirHandleOrPath === 'string'
      ? dirHandleOrPath.split(/[\\/]/).pop() || dirHandleOrPath
      : dirHandleOrPath.name;
  }

  await db.boards.add(board);
  return board;
}

/**
 * Open a board from a folder. If a board with the same ID already exists in
 * IndexedDB (e.g. previously opened from this folder), it is updated in-place
 * rather than duplicated. The folder is always the source of truth.
 */
export async function createBoardFromFolder(
  handleOrPath: FileSystemDirectoryHandle | string,
): Promise<Board> {
  const { board: boardData, objects, files } = await readBoardFromFolder(handleOrPath);

  const boardId = boardData.id || crypto.randomUUID();

  // Check if this board already exists in IndexedDB (re-opening same folder)
  const existing = await db.boards.get(boardId);

  // Reuse existing dir handle ID, or create a new one
  const handleId = existing?.dirHandleId || crypto.randomUUID();
  await saveDirHandle(handleId, handleOrPath);

  const board: Board = {
    ...boardData,
    id: boardId,
    dirHandleId: handleId,
    folderName: typeof handleOrPath === 'string'
      ? handleOrPath.split(/[\\/]/).pop() || handleOrPath
      : handleOrPath.name,
    thumbnail: existing?.thumbnail, // preserve cached thumbnail
    modifiedAt: Date.now(),
  };

  // Upsert all file blobs into IndexedDB
  for (const file of files) {
    await db.files.put(file);
  }

  // Rebuild objects with the correct boardId
  const boardObjects = objects.map(o => ({ ...o, boardId }));

  await db.transaction('rw', [db.boards, db.objects], async () => {
    // Upsert the board
    await db.boards.put(board);
    // Replace all objects for this board with the folder's contents
    await db.objects.where('boardId').equals(boardId).delete();
    if (boardObjects.length > 0) {
      await db.objects.bulkPut(boardObjects);
    }
  });

  return board;
}

export async function getAllBoards(): Promise<Board[]> {
  return db.boards.orderBy('modifiedAt').reverse().toArray();
}

export async function getBoard(id: string): Promise<Board | undefined> {
  return db.boards.get(id);
}

export async function updateBoard(id: string, changes: Partial<Board>): Promise<void> {
  await db.boards.update(id, { ...changes, modifiedAt: Date.now() });
}

export async function deleteBoard(id: string): Promise<void> {
  const board = await db.boards.get(id);
  const dirHandleId = board?.dirHandleId;

  await db.transaction('rw', [db.boards, db.objects, db.files, db.dirHandles], async () => {
    const objects = await db.objects.where('boardId').equals(id).toArray();
    const fileIds = new Set<string>();
    for (const obj of objects) {
      if ((obj.type === 'image' || obj.type === 'file') && 'fileId' in obj) {
        fileIds.add(obj.fileId);
      }
    }
    if (fileIds.size > 0) {
      await db.files.bulkDelete([...fileIds]);
    }
    await db.objects.where('boardId').equals(id).delete();
    await db.boards.delete(id);
    if (dirHandleId) {
      await db.dirHandles.delete(dirHandleId);
    }
  });
}

export async function duplicateBoard(id: string): Promise<Board | undefined> {
  const original = await db.boards.get(id);
  if (!original) return undefined;

  const newBoardId = crypto.randomUUID();
  const objects = await db.objects.where('boardId').equals(id).toArray();

  const idMap = new Map<string, string>();
  for (const obj of objects) {
    idMap.set(obj.id, crypto.randomUUID());
  }

  const layerIdMap = new Map<string, string>();
  for (const layer of original.layers ?? []) {
    layerIdMap.set(layer.id, crypto.randomUUID());
  }

  const newBoard: Board = {
    ...original,
    id: newBoardId,
    title: `${original.title} (copy)`,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    layers: (original.layers ?? []).map(l => ({
      ...l,
      id: layerIdMap.get(l.id)!,
      boardId: newBoardId,
    })),
  };

  const newObjects = objects.map((obj) => {
    const newObj: CanvasObject = {
      ...obj,
      id: idMap.get(obj.id)!,
      boardId: newBoardId,
      layerId: obj.layerId ? (layerIdMap.get(obj.layerId) ?? null) : null,
    } as CanvasObject;
    if (obj.type === 'arrow') {
      return {
        ...newObj,
        startObjectId: obj.startObjectId ? (idMap.get(obj.startObjectId) ?? null) : null,
        endObjectId: obj.endObjectId ? (idMap.get(obj.endObjectId) ?? null) : null,
      };
    }
    return newObj;
  });

  await db.transaction('rw', [db.boards, db.objects], async () => {
    await db.boards.add(newBoard);
    await db.objects.bulkAdd(newObjects);
  });

  return newBoard;
}
