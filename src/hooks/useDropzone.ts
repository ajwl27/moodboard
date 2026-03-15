import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { addFileWithFolderSync } from '../db/filesystem';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnails';
import { normalizeUrl, fetchOGMetadata, URL_REGEX, fetchImage } from '../utils/opengraph';
import type { ImageCard, FileCard, LinkCard, FileRecord } from '../types';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg)$/.test(pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
  }
}

export function useDropzone(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const state = useCanvasStore.getState();
      if (!state.boardId) return;

      const rect = el.getBoundingClientRect();
      const cam = state.camera;
      const baseX = (e.clientX - rect.left) / cam.zoom - cam.x;
      const baseY = (e.clientY - rect.top) / cam.zoom - cam.y;

      const files = e.dataTransfer?.files;

      // Handle file drops
      if (files && files.length > 0) {
        const newObjects: (ImageCard | FileCard)[] = [];
        const spacing = 220;
        const cols = Math.ceil(Math.sqrt(files.length));

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = baseX + col * spacing;
          const y = baseY + row * spacing;

          const fileId = crypto.randomUUID();
          const isImage = IMAGE_TYPES.includes(file.type);

          // Store file
          const blob = file;
          let thumbnailBlob: Blob | undefined;
          if (isImage) {
            try {
              thumbnailBlob = await generateThumbnail(blob, 800, 800);
            } catch {
              thumbnailBlob = undefined;
            }
          }

          const fileRecord: FileRecord = {
            id: fileId,
            blob,
            thumbnailBlob,
            originalFilename: file.name,
            mimeType: file.type,
            size: file.size,
          };
          await addFileWithFolderSync(fileRecord, state.boardId);

          if (isImage) {
            let imgW = 200, imgH = 200;
            try {
              const dims = await getImageDimensions(blob);
              imgW = dims.width;
              imgH = dims.height;
            } catch { /* fallback to 200x200 */ }

            newObjects.push({
              id: crypto.randomUUID(),
              boardId: state.boardId,
              type: 'image',
              x,
              y,
              width: imgW,
              height: imgH,
              zIndex: state.getMaxZIndex() + 1 + i,
              locked: false,
              colour: '#ffffff',
              fileId,
              originalFilename: file.name,
              caption: '',
              objectFit: 'cover',
              layerId: state.activeLayerId,
            });
          } else {
            newObjects.push({
              id: crypto.randomUUID(),
              boardId: state.boardId,
              type: 'file',
              x,
              y,
              width: 200,
              height: 80,
              zIndex: state.getMaxZIndex() + 1 + i,
              locked: false,
              colour: '#ffffff',
              fileId,
              originalFilename: file.name,
              fileSize: file.size,
              mimeType: file.type,
              layerId: state.activeLayerId,
            });
          }
        }

        if (newObjects.length > 0) {
          state.addObjects(newObjects);
          state.setSelectedIds(new Set(newObjects.map((o) => o.id)));
        }
        return;
      }

      // Handle URL/URI drops (e.g. dragging image or link from a web page)
      const uriList = e.dataTransfer?.getData('text/uri-list') || '';
      const textPlain = e.dataTransfer?.getData('text/plain') || '';
      const droppedUrl = (uriList.split('\n').find((l) => l.trim() && !l.startsWith('#')) || textPlain).trim();

      if (!droppedUrl || !URL_REGEX.test(droppedUrl)) return;

      const url = normalizeUrl(droppedUrl);

      if (isImageUrl(url)) {
        // Fetch image and create ImageCard
        try {
          const res = await fetchImage(url);
          const blob = await res.blob();
          if (!blob.type.startsWith('image/')) throw new Error('Not an image');

          const fileId = crypto.randomUUID();
          let thumbnailBlob: Blob | undefined;
          try {
            thumbnailBlob = await generateThumbnail(blob, 800, 800);
          } catch { /* skip */ }

          const fileRecord: FileRecord = {
            id: fileId,
            blob,
            thumbnailBlob,
            originalFilename: url.split('/').pop() || 'image',
            mimeType: blob.type,
            size: blob.size,
          };
          await addFileWithFolderSync(fileRecord, state.boardId);

          let imgW = 200, imgH = 200;
          try {
            const dims = await getImageDimensions(blob);
            imgW = dims.width;
            imgH = dims.height;
          } catch { /* fallback */ }

          const card: ImageCard = {
            id: crypto.randomUUID(),
            boardId: state.boardId,
            type: 'image',
            x: baseX,
            y: baseY,
            width: imgW,
            height: imgH,
            zIndex: state.getMaxZIndex() + 1,
            locked: false,
            colour: '#ffffff',
            fileId,
            originalFilename: fileRecord.originalFilename,
            caption: '',
            objectFit: 'cover',
            layerId: state.activeLayerId,
          };
          state.addObject(card);
          state.select(card.id);
        } catch {
          // Image fetch failed — fall through to create a link card instead
          createLinkCard(url, baseX, baseY, state);
        }
      } else {
        createLinkCard(url, baseX, baseY, state);
      }
    };

    function createLinkCard(url: string, x: number, y: number, state: ReturnType<typeof useCanvasStore.getState>) {
      const cardId = crypto.randomUUID();
      const card: LinkCard = {
        id: cardId,
        boardId: state.boardId!,
        type: 'link',
        x,
        y,
        width: 240,
        height: 160,
        zIndex: state.getMaxZIndex() + 1,
        locked: false,
        colour: '#ffffff',
        url,
        title: '',
        description: '',
        thumbnailUrl: '',
        targetBoardId: null,
        layerId: state.activeLayerId,
      };
      state.addObject(card);
      state.select(card.id);
      fetchOGMetadata(url).then((og) => {
        if (!og.title && !og.description && !og.image) return;
        useCanvasStore.setState((s) => ({
          objects: s.objects.map((o) =>
            o.id === cardId && o.type === 'link'
              ? { ...o, title: og.title || o.title, description: og.description || o.description, thumbnailUrl: og.image || o.thumbnailUrl }
              : o
          ) as typeof s.objects,
          dirtyObjectIds: new Set(s.dirtyObjectIds).add(cardId),
        }));
      });
    }

    el.addEventListener('dragenter', prevent);
    el.addEventListener('dragover', prevent);
    el.addEventListener('dragleave', prevent);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragenter', prevent);
      el.removeEventListener('dragover', prevent);
      el.removeEventListener('dragleave', prevent);
      el.removeEventListener('drop', handleDrop);
    };
  }, [containerRef]);
}
