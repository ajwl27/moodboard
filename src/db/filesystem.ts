import { db } from './schema';
import { addFile, getFile } from './objects';
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

  const { thumbnail, ...boardData } = board;
  void thumbnail;

  if (typeof handleOrPath === 'string') {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    await writeTextFile(await join(handleOrPath, 'board.json'), JSON.stringify(boardData, null, 2));
    await writeTextFile(await join(handleOrPath, 'objects.json'), JSON.stringify(objects, null, 2));
    await writeTextFile(await join(handleOrPath, 'files.json'), JSON.stringify(fileMetas, null, 2));
  } else {
    await writeJsonFile(handleOrPath, 'board.json', boardData);
    await writeJsonFile(handleOrPath, 'objects.json', objects);
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
          if (!(await exists(assetPath))) continue;
          const data = await readFile(assetPath);
          const blob = new Blob([data], { type: meta.mimeType });

          let thumbnailBlob: Blob | undefined;
          try {
            const thumbPath = await join(assetsDir, `${fileId}.thumb.bin`);
            if (await exists(thumbPath)) {
              const thumbData = await readFile(thumbPath);
              thumbnailBlob = new Blob([thumbData], { type: meta.mimeType });
            }
          } catch { /* no thumbnail */ }

          files.push({
            id: fileId, blob, thumbnailBlob,
            originalFilename: meta.originalFilename, mimeType: meta.mimeType, size: meta.size,
          });
        } catch { /* skip missing asset */ }
      }
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
  await addFile(fileRecord);
  if (!boardId) return;

  const board = await getBoard(boardId);
  if (!board?.dirHandleId) return;

  const handle = await getDirHandle(board.dirHandleId);
  if (!handle) return;

  try {
    await writeAssetToFolder(handle, fileRecord);
  } catch {
    // Folder sync failed silently — IndexedDB save already succeeded
  }
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
