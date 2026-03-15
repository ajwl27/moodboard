import { useState, useCallback, useEffect } from 'react';

interface ContextMenuState {
  x: number;
  y: number;
  targetElement: HTMLElement;
}

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const showContextMenu = useCallback((x: number, y: number, target: HTMLElement) => {
    setContextMenu({ x, y, targetElement: target });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') handler();
    });
    return () => {
      window.removeEventListener('click', handler);
    };
  }, [contextMenu]);

  return { contextMenu, showContextMenu, hideContextMenu };
}
