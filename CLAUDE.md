# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

moody — a single-user, local-first infinite canvas app for organising creative projects (moodboards, research boards, project planning). No server, no accounts, no collaboration. All data persists locally on disk.

The full specification is in `BUILD_INSTRUCTIONS.md`.

## Status

Greenfield project. No code has been written yet. `BUILD_INSTRUCTIONS.md` contains the complete product spec and should be treated as the source of truth for requirements.

## Architecture

### Two views
- **Home View**: Grid of board thumbnails with create/rename/duplicate/delete. Landing page.
- **Board View**: Infinite 2D canvas with pan/zoom. All content manipulation happens here.

### Data model
- `App State` → `Board[]` → `CanvasObject[]`
- Six object types: `image`, `text`, `link`, `file`, `group`, `arrow`
- All types share base fields (id, type, x, y, width, height, zIndex, locked, colour)
- Groups are visual regions only — containment is by spatial overlap, not parent-child data relationship
- Arrows can snap to object edges via `startObjectId`/`endObjectId` and follow when objects move

### Persistence
- Local-only storage (IndexedDB, File System Access API, OPFS, or hybrid)
- Board metadata loaded at startup; full board data loaded on open
- Images/files stored as actual files, referenced by path/ID (not base64 in JSON)
- Auto-save on every change, debounced
- Must survive browser crashes

### Performance constraints
- 60fps pan/zoom with 200+ objects
- Viewport culling — don't render off-screen objects
- Thumbnail/downscale images for canvas display
- Debounce persistence writes
- Board list loads in <1s with 100+ boards

## Key Behaviours

- **Pan**: middle-mouse drag, space+left-drag, two-finger trackpad
- **Zoom**: scroll wheel toward cursor, pinch; range ~10%–500%
- **Adding content**: drag-drop from filesystem, paste from clipboard (images/URLs/text), double-click empty space for text card, toolbar buttons
- **Undo/redo**: command stack, doesn't need to persist across sessions
- **Smart guides**: optional snap-to-grid (off by default), Figma-style alignment guides

## Out of Scope

Multi-user, auth, cloud sync, mobile/touch, export, import, templates, video embeds, version history, comments, cross-board search, nested boards, service workers. See BUILD_INSTRUCTIONS.md § "What Not To Build".
