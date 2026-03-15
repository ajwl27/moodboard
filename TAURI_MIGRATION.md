# Tauri Migration Instructions for Spatial Project Organiser

These instructions are for Claude Code. The goal is to wrap the existing Vite + React app as a cross-platform desktop application using Tauri v2, producing native installers for Windows, macOS, and Linux. The app currently runs as a browser SPA with all data in IndexedDB. Several browser-specific APIs need replacing with Tauri equivalents for cross-browser-engine compatibility (the app must work in WebKit, not just Chromium).

## Prerequisites

Before starting, install the Tauri CLI and Rust toolchain:

```bash
# Install Rust (if not already present)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
npm install -D @tauri-apps/cli@latest

# Initialise Tauri in the existing project
npx tauri init
```

During `tauri init`, use these answers:
- App name: `Spatial Project Organiser`
- Window title: `Spatial Project Organiser`
- Web assets path: `../dist`
- Dev server URL: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`

This creates a `src-tauri/` directory with `Cargo.toml`, `tauri.conf.json`, and a Rust `main.rs`.

Install the required Tauri plugins (these replace browser APIs that don't work in WebKit):

```bash
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-http @tauri-apps/plugin-clipboard-manager @tauri-apps/api
```

In `src-tauri/Cargo.toml`, add the corresponding Rust crates:

```toml
[dependencies]
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-http = "2"
tauri-plugin-clipboard-manager = "2"
```

Register all plugins in `src-tauri/src/main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Configure permissions in `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-copy-file",
    "fs:allow-stat",
    "fs:allow-readdir",
    "fs:allow-app-write",
    "fs:allow-app-read",
    "fs:allow-app-meta",
    "fs:scope-app-local",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-ask",
    "dialog:allow-message",
    "http:default",
    "http:allow-fetch",
    "clipboard-manager:default",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-image",
    "clipboard-manager:allow-write-image"
  ]
}
```

**Note on `fs:scope`:** The default scoping restricts file access to the app's own data directories. For the folder-sync feature (where users pick arbitrary directories), you will need to add broader scope permissions or use `fs:allow-read` / `fs:allow-write` with the dialog plugin's returned paths, which are automatically granted temporary scope. Check the Tauri v2 docs for the latest scoping model — this area changes between releases.

---

## Overview of What Needs Changing

The app uses several browser APIs that are Chromium-only or behave differently in WebKit. Here is the complete list of files that need modification and why.

### Critical changes (app won't function without these)

| File | Browser API used | Tauri replacement | What it does |
|------|-----------------|-------------------|--------------|
| `src/db/filesystem.ts` | `showDirectoryPicker`, `FileSystemDirectoryHandle`, `createWritable`, `requestPermission` | `@tauri-apps/plugin-dialog` (open/save dialogs) + `@tauri-apps/plugin-fs` (read/write/mkdir) | Folder-sync feature: pick a directory, read/write board JSON and asset files |
| `src/stores/boardListStore.ts` | Calls `pickDirectory()` from filesystem.ts | Same — the store just calls the filesystem module | "Create board in folder" and "Open from folder" actions on home screen |
| `src/utils/opengraph.ts` | `fetch()` with `mode: 'cors'` | `@tauri-apps/plugin-http` fetch | Fetches OpenGraph metadata from URLs for link card previews. Browser fetch fails cross-origin in WebKit; Tauri's HTTP plugin has no CORS restrictions |

### High-priority changes (features broken without these)

| File | Browser API used | Tauri replacement | What it does |
|------|-----------------|-------------------|--------------|
| `src/hooks/useClipboard.ts` | `ClipboardEvent.clipboardData.items`, `item.getAsFile()` | `@tauri-apps/plugin-clipboard-manager` (for reading images); standard DOM paste events may still work for text | Paste images, URLs, and text onto the canvas |
| `src/components/cards/FileCard.tsx` | `URL.createObjectURL` + `<a download>` click trick | `@tauri-apps/plugin-dialog` save dialog + `@tauri-apps/plugin-fs` write | Double-click a file card to download/save the attached file |
| `src/utils/exportCanvas.ts` | `<a download>` click trick for PNG/JPG export; `jsPDF.save()` for PDF | `@tauri-apps/plugin-dialog` save dialog + `@tauri-apps/plugin-fs` writeBinaryFile | Export canvas as image or PDF |

### Medium-priority (may work but needs testing/adjustment)

| File | Concern | Notes |
|------|---------|-------|
| `src/utils/thumbnails.ts` | Uses `createImageBitmap` and `OffscreenCanvas` | These are standard APIs but WebKit support varies. `createImageBitmap` works in Safari 15+. `OffscreenCanvas` has limited Safari support. The code already has a fallback path using `document.createElement('canvas')` — verify this fallback triggers correctly in WebKit |
| `src/hooks/useDropzone.ts` | Uses `DataTransfer` API (`e.dataTransfer.files`, `getData('text/uri-list')`) | Standard API, should work in Tauri's webview. Test with file drops from the OS file manager and URL drops. The image-URL-fetch in this file (line 145: `await fetch(url)`) will need the same treatment as opengraph.ts if CORS is an issue |
| `src/db/schema.ts` | `dirHandles` table stores `FileSystemDirectoryHandle` objects | This table becomes unnecessary in Tauri. You can either remove it or repurpose it to store directory path strings instead of handle objects |

### No changes needed

| File/Area | Why |
|-----------|-----|
| `src/db/schema.ts` (boards, objects, files tables) | Dexie/IndexedDB works fine in Tauri's webview. No migration to SQLite is required. |
| All Zustand stores (except boardListStore) | Pure JS state management, no browser API dependency |
| All React components (rendering, layout, interaction) | Standard DOM/React, works in any webview |
| `src/utils/geometry.ts`, `src/utils/colours.ts`, `src/utils/fileIcons.ts` | Pure utility functions, no browser API dependency |
| Canvas 2D rendering in exportCanvas.ts | `CanvasRenderingContext2D` is standard and works in WebKit. Only the *export/download* mechanism needs changing, not the rendering |
| `react-router-dom` routing | Client-side routing works fine in Tauri |

---

## Detailed Migration Instructions

### 1. Replace `src/db/filesystem.ts`

This is the largest change. The current file uses the File System Access API throughout. Replace all of it with Tauri's fs and dialog plugins.

**Current API surface to replace:**

```typescript
// These all use browser File System Access API — replace every one:
pickDirectory()                          // → dialog.open({ directory: true })
saveDirHandle(id, handle)               // → store path string instead of handle
getDirHandle(id)                        // → retrieve stored path string
writeBoardToFolder(handle, board, objects) // → use fs.writeTextFile with path
writeAssetToFolder(handle, fileRecord)    // → use fs.writeBinaryFile with path
readBoardFromFolder(handle)              // → use fs.readTextFile / fs.readFile with path
deleteAssetFromFolder(handle, fileId)     // → use fs.remove with path
addFileWithFolderSync(fileRecord, boardId) // → update to use path-based writes
```

**Key design change:** Instead of storing `FileSystemDirectoryHandle` objects in IndexedDB (the `dirHandles` table), store the directory path as a plain string. Tauri gives you the path from the dialog plugin, and you use that path with the fs plugin. The concept of "requesting permission" on a stored handle goes away — Tauri has persistent filesystem access once the user has picked a directory.

**New implementation approach:**

```typescript
import { open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeBinaryFile, readTextFile, readFile, mkdir, remove, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

// Replace pickDirectory:
export async function pickDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;  // returns the path string, or null if cancelled
}

// Replace writeBoardToFolder — takes a path string, not a handle:
export async function writeBoardToFolder(
  dirPath: string,
  board: Board,
  objects: CanvasObject[],
): Promise<void> {
  // ... collect file metadata same as before ...
  const { thumbnail, ...boardData } = board;
  await writeTextFile(await join(dirPath, 'board.json'), JSON.stringify(boardData, null, 2));
  await writeTextFile(await join(dirPath, 'objects.json'), JSON.stringify(objects, null, 2));
  await writeTextFile(await join(dirPath, 'files.json'), JSON.stringify(fileMetas, null, 2));
}

// Replace writeAssetToFolder:
export async function writeAssetToFolder(
  dirPath: string,
  fileRecord: FileRecord,
): Promise<void> {
  const assetsDir = await join(dirPath, 'assets');
  if (!(await exists(assetsDir))) {
    await mkdir(assetsDir, { recursive: true });
  }
  // Convert Blob to Uint8Array for Tauri's writeBinaryFile
  const buffer = new Uint8Array(await fileRecord.blob.arrayBuffer());
  await writeBinaryFile(await join(assetsDir, `${fileRecord.id}.bin`), buffer);
  if (fileRecord.thumbnailBlob) {
    const thumbBuffer = new Uint8Array(await fileRecord.thumbnailBlob.arrayBuffer());
    await writeBinaryFile(await join(assetsDir, `${fileRecord.id}.thumb.bin`), thumbBuffer);
  }
}

// Replace readBoardFromFolder:
export async function readBoardFromFolder(
  dirPath: string,
): Promise<{ board: Board; objects: CanvasObject[]; files: FileRecord[] }> {
  const boardData = JSON.parse(await readTextFile(await join(dirPath, 'board.json'))) as Board;
  const objects = JSON.parse(await readTextFile(await join(dirPath, 'objects.json'))) as CanvasObject[];
  // ... reconstruct FileRecords from assets/ using readFile ...
}
```

**Changes to data model:** The `Board` type has `dirHandleId?: string` which currently references a stored `FileSystemDirectoryHandle`. Change this to `folderPath?: string` (or reuse the existing `folderName` field) to store the actual filesystem path. The `dirHandles` table in `src/db/schema.ts` can be removed or repurposed — you no longer need to persist opaque handle objects.

**Update `src/stores/boardListStore.ts`:** The store imports `pickDirectory` from filesystem.ts. After the filesystem.ts rewrite, update the store's `createBoardInFolder` and `openFromFolder` methods to work with path strings instead of handles. The store itself doesn't use browser APIs directly, so the changes are just about passing strings where handles used to go.

### 2. Replace fetch in `src/utils/opengraph.ts`

The current code uses `fetch()` with `mode: 'cors'`. In Tauri's WebKit webview, cross-origin fetches to arbitrary websites will fail. Replace with Tauri's HTTP plugin:

```typescript
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// Replace the direct fetch fallback (lines 37-42):
const response = await tauriFetch(url, {
  method: 'GET',
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpatialOrganiser/1.0)' },
  connectTimeout: 5000,
});
const html = await response.text();
```

The microlink.io API call (line 19) should also use `tauriFetch` for consistency, since it's also a cross-origin request.

`DOMParser` is a standard API and works in WebKit — no change needed for the HTML parsing part.

### 3. Replace clipboard handling in `src/hooks/useClipboard.ts`

The current approach uses standard DOM `paste` events (`ClipboardEvent.clipboardData`). This *may* work in Tauri's webview for text paste, but image paste behaviour differs across webview engines.

**Recommended approach:** Keep the DOM paste event listener as the primary mechanism (it's the most natural for a web app), but add a fallback using Tauri's clipboard plugin for cases where the DOM event doesn't provide image data:

```typescript
import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager';

// Inside handlePaste, if no image found in clipboardData.items:
try {
  const clipImage = await readImage();
  if (clipImage) {
    // clipImage is an Image object with rgba() method
    const rgba = await clipImage.rgba();
    // Convert to a Blob or use directly
    // ... create ImageCard as before ...
  }
} catch {
  // No image in clipboard, continue to text handling
}
```

Test this carefully — the DOM paste path may work fine in WebKit for common cases (pasting images from other apps), in which case the Tauri plugin fallback is just a safety net.

### 4. Replace file download in `src/components/cards/FileCard.tsx`

The current code creates an object URL and simulates an `<a download>` click. This won't trigger a save dialog in all webview engines. Replace with Tauri's save dialog + fs write:

```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeBinaryFile } from '@tauri-apps/plugin-fs';

const handleDoubleClick = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation();
  const file = await getFile(obj.fileId);
  if (file) {
    const savePath = await save({
      defaultPath: file.originalFilename,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (savePath) {
      const buffer = new Uint8Array(await file.blob.arrayBuffer());
      await writeBinaryFile(savePath, buffer);
    }
  }
}, [obj.fileId]);
```

### 5. Replace export download in `src/utils/exportCanvas.ts`

Same pattern as FileCard. Replace the `<a download>` trick (lines 70-77) and the `jsPDF.save()` call (line 64) with Tauri save dialog + fs write:

```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeBinaryFile } from '@tauri-apps/plugin-fs';

// For PNG/JPG export (replace lines 66-78):
const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, jpgQ));
if (!blob) return;
const savePath = await save({
  defaultPath: filename,
  filters: [{ name: format.toUpperCase(), extensions: [format] }],
});
if (savePath) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeBinaryFile(savePath, buffer);
}

// For PDF export (replace lines 60-64):
const pdfBytes = doc.output('arraybuffer');  // jsPDF can output ArrayBuffer instead of triggering download
const savePath = await save({
  defaultPath: filename,
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
});
if (savePath) {
  await writeBinaryFile(savePath, new Uint8Array(pdfBytes));
}
```

### 6. Replace fetch in `src/hooks/useDropzone.ts`

Line 145 fetches image URLs dropped onto the canvas:

```typescript
const res = await fetch(url);
```

Replace with Tauri's HTTP plugin fetch, same as the opengraph change:

```typescript
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
const res = await tauriFetch(url, { method: 'GET' });
```

### 7. Handle `OffscreenCanvas` fallback in `src/utils/thumbnails.ts`

The code already has a fallback from `OffscreenCanvas` to `document.createElement('canvas')` (line 28 onwards). Safari/WebKit has limited `OffscreenCanvas` support. The fallback should trigger automatically, but verify by testing thumbnail generation in the Tauri dev build. If `createImageBitmap` also fails (unlikely in modern WebKit, but possible), add a fallback using `new Image()` with an object URL:

```typescript
// Fallback if createImageBitmap is unavailable:
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
```

### 8. Clean up `src/db/schema.ts`

The `dirHandles` table (version 3 migration, line 31) stores `FileSystemDirectoryHandle` objects. These are Chromium-only structured-cloneable objects that don't exist in WebKit.

Options:
- **Remove the table entirely** if you store folder paths directly on the Board object (recommended).
- **Repurpose it** to store `{ id: string; path: string }` records instead.

If you remove it, bump the Dexie version number and remove the table from the stores definition. Existing IndexedDB data from the browser version won't carry over to Tauri anyway (different webview, different origin), so there's no migration concern.

---

## Detecting Tauri vs Browser Environment

If you want to keep the app working as both a web app and a Tauri desktop app from the same codebase, gate Tauri-specific code behind a runtime check:

```typescript
// Returns true when running inside Tauri
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}
```

Use this to conditionally import/call Tauri plugins vs browser APIs. For example in filesystem.ts:

```typescript
export async function pickDirectory(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false });
    return selected as string | null;
  } else {
    // Browser fallback — use showDirectoryPicker if available
    if ('showDirectoryPicker' in window) {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return handle.name;  // limited — can't get full path in browser
    }
    return null;
  }
}
```

This is optional. If you're committing fully to Tauri and dropping the browser version, skip the dual-mode complexity and just use Tauri APIs directly.

---

## Tauri Configuration

### `src-tauri/tauri.conf.json` key settings

```json
{
  "productName": "Spatial Project Organiser",
  "version": "0.1.0",
  "identifier": "com.spatialorganiser.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev"
  },
  "app": {
    "windows": [
      {
        "title": "Spatial Project Organiser",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://api.microlink.io https://www.google.com"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**CSP note:** The `connect-src` directive needs to include any external domains the app fetches from (microlink.io for OG metadata, google.com for favicons). Alternatively, since the Tauri HTTP plugin bypasses the webview's network stack, you may not need to whitelist these in CSP — test and adjust.

### App icons

Generate icons using Tauri's icon command:

```bash
npx tauri icon path/to/source-icon.png
```

This generates all required sizes and formats in `src-tauri/icons/`.

---

## Build & Distribution

### Development

```bash
npx tauri dev
```

This starts the Vite dev server and opens the Tauri window. Hot reload works normally.

### Production build

```bash
npx tauri build
```

This produces platform-specific installers:
- **Windows:** `.msi` and `.exe` installer in `src-tauri/target/release/bundle/msi/` and `nsis/`
- **macOS:** `.dmg` and `.app` in `src-tauri/target/release/bundle/dmg/`
- **Linux:** `.deb`, `.rpm`, `.AppImage` in `src-tauri/target/release/bundle/deb/` etc.

The resulting app is typically 5-15MB (vs ~150MB for Electron) because it uses the OS's native webview rather than bundling Chromium.

### Cross-compilation

Tauri cannot cross-compile. You need to build on each target platform:
- Build Windows installer on Windows
- Build macOS .dmg on macOS
- Build Linux packages on Linux

For CI/CD, use GitHub Actions with a matrix of `macos-latest`, `windows-latest`, `ubuntu-latest` runners.

---

## Testing Checklist

After migration, verify all of these work in the Tauri build:

### Core functionality (must work)
- [ ] Create a new board
- [ ] Pan and zoom the canvas (middle-mouse drag, scroll wheel, trackpad gestures)
- [ ] Add text cards (double-click empty space)
- [ ] Drag-drop image files from OS file manager onto canvas
- [ ] Drag-drop non-image files onto canvas
- [ ] Paste images from clipboard (Cmd/Ctrl+V)
- [ ] Paste URLs from clipboard → creates link card
- [ ] Paste plain text from clipboard → creates text card
- [ ] Link cards fetch and display OG metadata (title, description, thumbnail)
- [ ] Resize, move, lock/unlock objects
- [ ] Draw arrows between objects
- [ ] Undo/redo
- [ ] Delete objects
- [ ] Return to home view and see board thumbnails
- [ ] Rename and delete boards from home view

### Folder sync (needs new Tauri implementation)
- [ ] "Create board in folder" opens native directory picker
- [ ] Board data (board.json, objects.json, files.json) written to chosen folder
- [ ] Assets written to assets/ subdirectory
- [ ] "Open from folder" reads board data back in
- [ ] Changes auto-sync to folder

### Export (needs new Tauri implementation)
- [ ] Export canvas as PNG → native save dialog → file saved correctly
- [ ] Export canvas as JPG → native save dialog → file saved correctly
- [ ] Export canvas as PDF → native save dialog → file saved correctly
- [ ] Double-click file card → native save dialog → file saved correctly

### Performance
- [ ] 60fps pan/zoom with 200+ objects
- [ ] Board list loads in <1s with many boards
- [ ] Thumbnail generation works (check OffscreenCanvas fallback fires in WebKit)

### Platform-specific
- [ ] Window resize behaves correctly
- [ ] Keyboard shortcuts work (Cmd on Mac, Ctrl on Windows/Linux)
- [ ] File drag-drop from OS file manager works on all target platforms

---

## Migration Order

Recommended sequence to minimise broken intermediate states:

1. **Initialise Tauri** (`tauri init`, install plugins, configure permissions). Verify `npx tauri dev` opens the app in its current state with no changes. Everything except folder-sync should work since the rest uses standard web APIs.

2. **Replace opengraph.ts fetch** with Tauri HTTP plugin. This is the smallest, most isolated change. Link card previews will start working in WebKit.

3. **Replace useDropzone.ts fetch** (line 145) with Tauri HTTP plugin. Same pattern as step 2.

4. **Replace filesystem.ts** entirely. This is the biggest change. Rewrite all functions to use path strings + Tauri fs/dialog plugins. Update the Board type and schema.ts accordingly.

5. **Update boardListStore.ts** to work with the new filesystem.ts API surface.

6. **Replace FileCard.tsx download** with Tauri save dialog.

7. **Replace exportCanvas.ts download** with Tauri save dialog.

8. **Test and fix clipboard** (useClipboard.ts). Try the DOM paste event first; add Tauri clipboard plugin fallback if image paste doesn't work.

9. **Test thumbnails.ts** in WebKit. Verify the OffscreenCanvas fallback works. Add createImageBitmap fallback if needed.

10. **Run the full testing checklist** above.

11. **Build installers** (`npx tauri build`) and test on each target platform.
