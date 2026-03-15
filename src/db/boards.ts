import { db } from './schema';
import { saveDirHandle, readBoardFromFolder } from './filesystem';
import { addFile } from './objects';
import type { Board, Camera, CanvasObject } from '../types';

const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 };

export async function createBoard(title: string, dirHandle?: FileSystemDirectoryHandle): Promise<Board> {
  const board: Board = {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    camera: defaultCamera,
    layers: [],
  };

  if (dirHandle) {
    const handleId = crypto.randomUUID();
    await saveDirHandle(handleId, dirHandle);
    board.dirHandleId = handleId;
    board.folderName = dirHandle.name;
  }

  await db.boards.add(board);
  return board;
}

export async function createBoardFromFolder(handle: FileSystemDirectoryHandle): Promise<Board> {
  const { board: boardData, objects, files } = await readBoardFromFolder(handle);

  // Assign a new ID so it doesn't collide with existing boards
  const boardId = boardData.id || crypto.randomUUID();

  const handleId = crypto.randomUUID();
  await saveDirHandle(handleId, handle);

  const board: Board = {
    ...boardData,
    id: boardId,
    dirHandleId: handleId,
    folderName: handle.name,
    modifiedAt: Date.now(),
  };

  // Store files in IndexedDB
  for (const file of files) {
    await addFile(file);
  }

  // Store objects in IndexedDB (ensure boardId matches)
  const boardObjects = objects.map(o => ({ ...o, boardId }));
  await db.transaction('rw', [db.boards, db.objects], async () => {
    await db.boards.add(board);
    if (boardObjects.length > 0) {
      await db.objects.bulkAdd(boardObjects);
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
  // Get board to check for dir handle before transaction
  const board = await db.boards.get(id);
  const dirHandleId = board?.dirHandleId;

  await db.transaction('rw', [db.boards, db.objects, db.files, db.dirHandles], async () => {
    // Get all objects for this board to find referenced files
    const objects = await db.objects.where('boardId').equals(id).toArray();
    const fileIds = new Set<string>();
    for (const obj of objects) {
      if ((obj.type === 'image' || obj.type === 'file') && 'fileId' in obj) {
        fileIds.add(obj.fileId);
      }
    }
    // Delete files, objects, board, and dir handle
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

  // Map old IDs to new IDs for internal references (arrows)
  const idMap = new Map<string, string>();
  for (const obj of objects) {
    idMap.set(obj.id, crypto.randomUUID());
  }

  // Map old layer IDs to new layer IDs
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
