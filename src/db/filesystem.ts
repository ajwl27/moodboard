import { db } from './schema';
import { getFile } from './objects';
import { getBoard } from './boards';
import { isTauri } from '../utils/tauri';
import type { Board, CanvasObject, FileRecord } from '../types';

// ============================================================
// Pick a directory
// ============================================================

export async function pickDirectory(): Promise<string | FileSystemDirectoryHandle> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false });
    if (!selected) throw new Error('No directory selected');
    return selected as string;
  }
  // Browser: File System Access API
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

// ============================================================
// Store / retrieve directory reference
// ============================================================

export async function saveDirHandle(id: string, handleOrPath: FileSystemDirectoryHandle | string): Promise<void> {
  if (typeof handleOrPath === 'string') {
    // Tauri: store path string in dirHandles table
    await db.dirHandles.put({ id, handle: handleOrPath as unknown as FileSystemDirectoryHandle });
    return;
  }
  // Browser: store the handle object
  await db.dirHandles.put({ id, handle: handleOrPath });
}

export async function getDirHandle(id: string): Promise<FileSystemDirectoryHandle | string | null> {
  const record = await db.dirHandles.get(id);
  if (!record) return null;

  if (isTauri()) {
    // In Tauri the "handle" field is actually a path string
    return record.handle as unknown as string;
  }

  // Browser: re-request permission on the handle
  const perm = await record.handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') return null;
  return record.handle;
}

// ============================================================
// Write board data to folder
// ============================================================

/** Fields that are local to this IndexedDB instance and should not be written to folder JSON */
function stripLocalFields(board: Board): Omit<Board, 'thumbnail' | 'dirHandleId' | 'folderName'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { thumbnail, dirHandleId, folderName, ...portable } = board;
  return portable;
}

export async function writeBoardToFolder(
  handleOrPath: FileSystemDirectoryHandle | string,
  board: Board,
  objects: CanvasObject[],
): Promise<void> {
  // Collect file metadata
  const fileIds = new Set<string>();
  for (const obj of objects) {
    if ((obj.type === 'image' || obj.type === 'file') && 'fileId' in obj) {
      fileIds.add(obj.fileId);
    }
  }
  const fileMetas: Record<string, { id: string; originalFilename: string; mimeType: string; size: number }> = {};
  for (const fid of fileIds) {
    const fr = await getFile(fid);
    if (fr) {
      fileMetas[fid] = { id: fr.id, originalFilename: fr.originalFilename, mimeType: fr.mimeType, size: fr.size };
    }
  }

  const boardData = stripLocalFields(board);

  // Strip boardId from objects before writing (it's implicit — they belong to this board)
  const portableObjects = objects.map(o => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { boardId, ...rest } = o;
    return rest;
  });

  if (typeof handleOrPath === 'string') {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    await writeTextFile(await join(handleOrPath, 'board.json'), JSON.stringify(boardData, null, 2));
    await writeTextFile(await join(handleOrPath, 'objects.json'), JSON.stringify(portableObjects, null, 2));
    await writeTextFile(await join(handleOrPath, 'files.json'), JSON.stringify(fileMetas, null, 2));
  } else {
    await writeJsonFile(handleOrPath, 'board.json', boardData);
    await writeJsonFile(handleOrPath, 'objects.json', portableObjects);
    await writeJsonFile(handleOrPath, 'files.json', fileMetas);
  }
}

// ============================================================
// Write a single asset to folder
// ============================================================

export async function writeAssetToFolder(
  handleOrPath: FileSystemDirectoryHandle | string,
  fileRecord: FileRecord,
): Promise<void> {
  if (typeof handleOrPath === 'string') {
    const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const assetsDir = await join(handleOrPath, 'assets');
    if (!(await exists(assetsDir))) {
      await mkdir(assetsDir, { recursive: true });
    }
    const buffer = new Uint8Array(await fileRecord.blob.arrayBuffer());
    await writeFile(await join(assetsDir, `${fileRecord.id}.bin`), buffer);
    if (fileRecord.thumbnailBlob) {
      const thumbBuffer = new Uint8Array(await fileRecord.thumbnailBlob.arrayBuffer());
      await writeFile(await join(assetsDir, `${fileRecord.id}.thumb.bin`), thumbBuffer);
    }
  } else {
    const assetsDir = await handleOrPath.getDirectoryHandle('assets', { create: true });
    const fileHandle = await assetsDir.getFileHandle(`${fileRecord.id}.bin`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(fileRecord.blob);
    await writable.close();
    if (fileRecord.thumbnailBlob) {
      const thumbHandle = await assetsDir.getFileHandle(`${fileRecord.id}.thumb.bin`, { create: true });
      const tw = await thumbHandle.createWritable();
      await tw.write(fileRecord.thumbnailBlob);
      await tw.close();
    }
  }
}

// ============================================================
// Read board from folder
// ============================================================

export async function readBoardFromFolder(
  handleOrPath: FileSystemDirectoryHandle | string,
): Promise<{ board: Board; objects: CanvasObject[]; files: FileRecord[] }> {
  if (typeof handleOrPath === 'string') {
    const { readTextFile, readFile, exists } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    const boardData = JSON.parse(await readTextFile(await join(handleOrPath, 'board.json'))) as Board;
    const objects = JSON.parse(await readTextFile(await join(handleOrPath, 'objects.json'))) as CanvasObject[];

    let fileMetas: Record<string, { id: string; originalFilename: string; mimeType: string; size: number }> = {};
    try {
      const filesPath = await join(handleOrPath, 'files.json');
      if (await exists(filesPath)) {
        fileMetas = JSON.parse(await readTextFile(filesPath)) as typeof fileMetas;
      }
    } catch { /* no files.json */ }

    const files: FileRecord[] = [];
    const assetsDir = await join(handleOrPath, 'assets');
    if (await exists(assetsDir)) {
      for (const [fileId, meta] of Object.entries(fileMetas)) {
        try {
          const assetPath = await join(assetsDir, `${fileId}.bin`);
          if (!(await exists(assetPath))) {
            console.warn('[readBoardFromFolder] Asset file missing:', assetPath);
            continue;
          }
          const raw = await readFile(assetPath);
          // Ensure proper Uint8Array — Tauri IPC may return a plain number array
          const data = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
          const blob = new Blob([data], { type: meta.mimeType });

          let thumbnailBlob: Blob | undefined;
          try {
            const thumbPath = await join(assetsDir, `${fileId}.thumb.bin`);
            if (await exists(thumbPath)) {
              const rawThumb = await readFile(thumbPath);
              const thumbData = rawThumb instanceof Uint8Array ? rawThumb : new Uint8Array(rawThumb);
              thumbnailBlob = new Blob([thumbData], { type: meta.mimeType });
            }
          } catch (e) { console.warn('[readBoardFromFolder] Failed to read thumbnail for', fileId, e); }

          files.push({
            id: fileId, blob, thumbnailBlob,
            originalFilename: meta.originalFilename, mimeType: meta.mimeType, size: meta.size,
          });
        } catch (e) { console.warn('[readBoardFromFolder] Failed to read asset', fileId, e); }
      }
    } else {
      console.warn('[readBoardFromFolder] No assets directory at:', assetsDir);
    }

    return { board: boardData, objects, files };
  }

  // Browser: File System Access API path
  const boardData = await readJsonFile(handleOrPath, 'board.json') as Board;
  const objects = await readJsonFile(handleOrPath, 'objects.json') as CanvasObject[];

  let fileMetas: Record<string, { id: string; originalFilename: string; mimeType: string; size: number }> = {};
  try {
    fileMetas = await readJsonFile(handleOrPath, 'files.json') as typeof fileMetas;
  } catch { /* no files.json */ }

  const files: FileRecord[] = [];
  let assetsDir: FileSystemDirectoryHandle | null = null;
  try { assetsDir = await handleOrPath.getDirectoryHandle('assets'); } catch { /* */ }

  if (assetsDir) {
    for (const [fileId, meta] of Object.entries(fileMetas)) {
      try {
        const fileHandle = await assetsDir.getFileHandle(`${fileId}.bin`);
        const file = await fileHandle.getFile();
        const blob = new Blob([await file.arrayBuffer()], { type: meta.mimeType });
        let thumbnailBlob: Blob | undefined;
        try {
          const thumbHandle = await assetsDir.getFileHandle(`${fileId}.thumb.bin`);
          const thumbFile = await thumbHandle.getFile();
          thumbnailBlob = new Blob([await thumbFile.arrayBuffer()], { type: meta.mimeType });
        } catch { /* */ }
        files.push({ id: fileId, blob, thumbnailBlob, originalFilename: meta.originalFilename, mimeType: meta.mimeType, size: meta.size });
      } catch { /* skip */ }
    }
  }

  return { board: boardData, objects, files };
}

// ============================================================
// Sync a folder-backed board: re-read folder → update IndexedDB
// Called every time a folder-backed board is opened so the folder
// is always the source of truth.
// ============================================================

export async function syncBoardFromFolder(
  boardId: string,
  handleOrPath: FileSystemDirectoryHandle | string,
): Promise<{ board: Board; objects: CanvasObject[] } | null> {
  try {
    const { board: folderBoard, objects: folderObjects, files } = await readBoardFromFolder(handleOrPath);

    // Upsert all file blobs into IndexedDB
    for (const file of files) {
      await db.files.put(file);
    }

    // Rebuild objects with correct boardId
    const boardObjects = folderObjects.map(o => ({ ...o, boardId }));

    // Get the existing board so we preserve dirHandleId / folderName / thumbnail
    const existing = await db.boards.get(boardId);

    const updatedBoard: Board = {
      ...folderBoard,
      id: boardId,
      dirHandleId: existing?.dirHandleId,
      folderName: existing?.folderName,
      thumbnail: existing?.thumbnail,
      modifiedAt: Date.now(),
    };

    await db.transaction('rw', [db.boards, db.objects], async () => {
      await db.boards.put(updatedBoard);
      // Replace all objects for this board with folder contents
      await db.objects.where('boardId').equals(boardId).delete();
      if (boardObjects.length > 0) {
        await db.objects.bulkPut(boardObjects);
      }
    });

    return { board: updatedBoard, objects: boardObjects };
  } catch (e) {
    console.warn('[syncBoardFromFolder] Failed to sync from folder, using IndexedDB data:', e);
    return null;
  }
}

// ============================================================
// Delete asset from folder
// ============================================================

export async function deleteAssetFromFolder(
  handleOrPath: FileSystemDirectoryHandle | string,
  fileId: string,
): Promise<void> {
  if (typeof handleOrPath === 'string') {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const assetsDir = await join(handleOrPath, 'assets');
    try {
      const assetPath = await join(assetsDir, `${fileId}.bin`);
      if (await exists(assetPath)) await remove(assetPath);
      const thumbPath = await join(assetsDir, `${fileId}.thumb.bin`);
      if (await exists(thumbPath)) await remove(thumbPath);
    } catch { /* */ }
  } else {
    try {
      const assetsDir = await handleOrPath.getDirectoryHandle('assets');
      try { await assetsDir.removeEntry(`${fileId}.bin`); } catch { /* */ }
      try { await assetsDir.removeEntry(`${fileId}.thumb.bin`); } catch { /* */ }
    } catch { /* */ }
  }
}

// ============================================================
// Add file to IndexedDB + sync to folder
// ============================================================

export async function addFileWithFolderSync(fileRecord: FileRecord, boardId?: string | null): Promise<void> {
  await db.files.put(fileRecord);
  if (!boardId) return;

  const board = await getBoard(boardId);
  if (!board?.dirHandleId) return;

  const handle = await getDirHandle(board.dirHandleId);
  if (!handle) return;

  // Write asset to folder immediately — don't swallow errors silently
  await writeAssetToFolder(handle, fileRecord);
}

// ============================================================
// Browser-only helpers
// ============================================================

async function writeJsonFile(handle: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readJsonFile(handle: FileSystemDirectoryHandle, name: string): Promise<unknown> {
  const fileHandle = await handle.getFileHandle(name);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}
