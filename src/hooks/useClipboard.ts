import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { addFileWithFolderSync } from '../db/filesystem';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnails';
import { normalizeUrl, fetchOGMetadata, URL_REGEX } from '../utils/opengraph';
import type { ImageCard, TextCard, LinkCard, FileRecord } from '../types';

export function useClipboard() {
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste while editing text
      const state = useCanvasStore.getState();
      if (state.editingObjectId) return;
      if (!state.boardId) return;

      // Don't intercept paste when focus is in an input/textarea (e.g. QuickAddBar)
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check for image data first
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const fileId = crypto.randomUUID();
          let thumbnailBlob: Blob | undefined;
          try {
            thumbnailBlob = await generateThumbnail(blob, 800, 800);
          } catch { /* skip thumbnail */ }

          const fileRecord: FileRecord = {
            id: fileId,
            blob,
            thumbnailBlob,
            originalFilename: `pasted-image-${Date.now()}.png`,
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

          const cam = state.camera;
          const viewportCenterX = (window.innerWidth / 2) / cam.zoom - cam.x;
          const viewportCenterY = (window.innerHeight / 2) / cam.zoom - cam.y;

          const card: ImageCard = {
            id: crypto.randomUUID(),
            boardId: state.boardId,
            type: 'image',
            x: viewportCenterX - imgW / 2,
            y: viewportCenterY - imgH / 2,
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
          return;
        }
      }

      // Check for text (URL or plain text)
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        e.preventDefault();
        const cam = state.camera;
        const vcx = (window.innerWidth / 2) / cam.zoom - cam.x;
        const vcy = (window.innerHeight / 2) / cam.zoom - cam.y;

        if (URL_REGEX.test(text)) {
          const url = normalizeUrl(text);
          const cardId = crypto.randomUUID();
          const card: LinkCard = {
            id: cardId,
            boardId: state.boardId,
            type: 'link',
            x: vcx - 120,
            y: vcy - 80,
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
          // Fetch OG metadata in background
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
        } else {
          const card: TextCard = {
            id: crypto.randomUUID(),
            boardId: state.boardId,
            type: 'text',
            x: vcx - 100,
            y: vcy - 50,
            width: 200,
            height: 100,
            zIndex: state.getMaxZIndex() + 1,
            locked: false,
            colour: '#ffffff',
            content: text,
            fontSize: 14,
            layerId: state.activeLayerId,
          };
          state.addObject(card);
          state.select(card.id);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);
}
