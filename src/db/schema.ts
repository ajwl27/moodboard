import Dexie, { type Table } from 'dexie';
import type { Board, CanvasObject, FileRecord } from '../types';

export interface DirHandleRecord {
  id: string;
  handle: FileSystemDirectoryHandle;
}

export class ProjectDB extends Dexie {
  boards!: Table<Board>;
  objects!: Table<CanvasObject>;
  files!: Table<FileRecord>;
  dirHandles!: Table<DirHandleRecord>;

  constructor() {
    super('spatial-organiser');
    this.version(1).stores({
      boards: 'id, modifiedAt',
      objects: 'id, boardId, type',
      files: 'id',
    });
    this.version(2).stores({
      boards: 'id, modifiedAt',
      objects: 'id, boardId, type, layerId',
      files: 'id',
    }).upgrade(tx => {
      return tx.table('objects').toCollection().modify(obj => {
        if (obj.layerId === undefined) obj.layerId = null;
      });
    });
    this.version(3).stores({
      boards: 'id, modifiedAt',
      objects: 'id, boardId, type, layerId',
      files: 'id',
      dirHandles: 'id',
    });
  }
}

export const db = new ProjectDB();
