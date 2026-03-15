# moody

I wanted a moodboard app for collecting inspiration for my new house. It needed to handle photos, product links, colour palettes, reference images, text and scribbles.

Every existing option I found was either subscription-based, cluttered with features I'd never use, ugly or otherwise just not very good.

So I built one with claude code. moody is a free, open-source, local-first infinite canvas. Drop images, notes, links, and files onto a board, arrange them however makes sense to you, and connect ideas with arrows. No accounts, no cloud, no server. All data stays on your machine, with each board working in a folder like Obsidian's vaults.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. That's it — no backend, no config.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Features

### Boards

Create as many boards as you need from the home screen. Each board is an independent infinite canvas with its own camera position, objects, and layers. Boards display auto-generated thumbnails so you can visually identify them at a glance.

- Create, rename, duplicate, and delete boards
- Boards remember their pan/zoom position between visits
- Auto-generated thumbnail previews on the home grid

### Canvas Objects

Currently there are eight object types:

| Type | Description |
|------|-------------|
| **Text Card** | Plain text card with configurable font size, colour, and optional background |
| **Note Card** | Titled note with a header, divider, and body, meant for structured thoughts |
| **Image Card** | Displays images with cover/contain fit, optional captions, cropping/rotating, and a full-resolution lightbox *(click for full resolution)* |
| **Link Card** | Bookmarks a URL with auto-fetched Open Graph metadata (title, description, thumbnail) |
| **File Card** | Attaches any file type, showing filename, size, and a type-appropriate icon |
| **Group Region** | A translucent labelled region for visually organising areas of the canvas |
| **Arrow** | Connects two points or snaps to object edges; supports solid/dashed/dotted styles, arrowheads, and curvature |
| **Drawing** | Freehand pen strokes drawn directly on the canvas |

### Infinite Canvas

- **Pan**: middle-mouse drag, Space + left-drag, or two-finger trackpad
- **Zoom**: scroll wheel toward cursor, pinch gesture; range ~10%–500%
- **Viewport culling**: only objects near the visible area are rendered, keeping performance smooth with hundreds of objects
- **Dot grid**: optional subtle background grid (togglable)

### Object Manipulation

- Click to select, Shift+click to multi-select, drag on empty space for marquee selection
- Drag to move (all selected objects move together)
- Resize via corner and edge handles (images maintain aspect ratio)
- Z-ordering: bring to front, send to back, bring forward, send backward
- Lock objects to prevent accidental moves
- Right-click context menu on objects and empty canvas

### Adding Content

- **Drag & drop** files from your OS onto the canvas — images become image cards, other files become file cards
- **Paste** from clipboard — images, URLs (auto-detected), or plain text each create the appropriate card type
- **Double-click** empty canvas to create a text card and start typing immediately
- **Toolbar** buttons and keyboard shortcuts for all object types

### Layers

Organise objects across named layers with per-layer visibility, opacity, locking, and colour coding. Toggle the layers panel with **L**.

### Drawing Tool

Freehand drawing directly on the canvas with configurable stroke colour, width, and an eraser tool. Toggle draw mode with **D**.

### Export

Export your entire board as **PNG**, **JPG**, or **PDF** at multiple quality levels (normal, high, ultra, uncompressed). The export renders all objects to a canvas and downloads the result.

### Undo / Redo

Full command-stack undo/redo for all operations. History resets when you leave the board.

### Smart Guides

Figma-style alignment guides appear when dragging objects near other objects' edges or centres.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` + drag | Pan canvas |
| Scroll wheel | Zoom |
| `Ctrl/Cmd + A` | Select all |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl/Cmd + C` | Copy |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + D` | Duplicate |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + 0` | Reset zoom to 100% |
| `Ctrl/Cmd + Shift + 0` | Zoom to fit all content |
| Arrow keys | Nudge selected 1px |
| `Shift` + Arrow keys | Nudge selected 10px |
| `T` | New text card |
| `N` | New note card |
| `A` | Arrow drawing mode |
| `D` | Draw mode |
| `G` | New group region |
| `L` | Toggle layers panel |
| `Escape` | Deselect / exit current mode |
| Double-click empty area | New text card at cursor |

---

## Persistence

All data is stored locally in the browser using **IndexedDB** (via [Dexie](https://dexie.org/)). Images and files are stored as blobs with generated thumbnails for fast rendering. Boards auto-save on every change (debounced) and survive browser crashes and restarts.

Board metadata loads at startup; full board data loads only when you open a board — so the home screen stays fast even with many boards.

---

## Tech Stack

- **React 19** with **TypeScript**
- **Vite 8** for dev server and builds
- **Zustand** for state management
- **Dexie** (IndexedDB) for local persistence
- **React Router** for navigation between home and board views
- **jsPDF** for PDF export
- CSS Modules for scoped styling

---

## Project Structure

```
src/
├── components/
│   ├── canvas/          # SelectionHandles, ArrowLayer, SelectionRect, CanvasObject
│   ├── cards/           # TextCard, NoteCard, ImageCard, LinkCard, FileCard, GroupRegion, DrawingCard
│   ├── ContextMenu.tsx
│   ├── CropModal.tsx
│   ├── LayersPanel.tsx
│   ├── Lightbox.tsx
│   └── QuickAddBar.tsx
├── db/
│   ├── schema.ts        # Dexie database schema
│   ├── boards.ts        # Board CRUD operations
│   ├── objects.ts       # Canvas object persistence
│   └── filesystem.ts    # File/image blob storage
├── hooks/               # useCamera, useSelection, useDragMove, useResize, useDropzone,
│                        # useClipboard, useArrowDrawing, useDrawing, useAutoSave,
│                        # useContextMenu, useViewportCulling, useKeyboardShortcuts
├── stores/
│   ├── canvasStore.ts   # Board view state (objects, selection, undo stack, camera)
│   └── boardListStore.ts # Home view state
├── utils/               # geometry, thumbnails, colours, clipboard, fileIcons, opengraph, exportCanvas
├── views/
│   ├── HomeView/        # Board grid, board cards
│   └── BoardView/       # Canvas, toolbar, top bar, property panel, draw toolbar
└── types/index.ts       # All TypeScript type definitions
```

---

## Licence

MIT
