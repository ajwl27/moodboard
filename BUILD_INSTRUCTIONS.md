# Build Instructions: Spatial Project Organiser

## What This App Is

A single-user, local-first, browser-based spatial canvas app for organising creative projects. Think Milanote but personal — no collaboration, no accounts, no server dependency. The user creates boards, drops content onto them (images, notes, links, files), arranges everything spatially on an infinite canvas, and connects related items with arrows. Everything persists locally on disk.

This is not a drawing tool. It's not a whiteboard. The core value proposition is **collecting heterogeneous content and arranging it meaningfully in space** — moodboards, research boards, project planning, reference collections. The spatial layout *is* the organisational structure.

## Core Architecture

### Application Structure

The app has two main views:

1. **Home / Board List** — a simple grid or list of all boards the user has created, with thumbnails, titles, and last-modified dates. This is the landing page. The user can create, rename, duplicate, and delete boards from here.

2. **Board View** — an infinite 2D canvas with pan and zoom. This is where all the work happens. The user places content cards on the canvas, moves them around, resizes them, connects them with arrows, and organises them into spatial arrangements.

Navigation between views: clicking a board in the home view opens it. A back button or breadcrumb in the board view returns to home. If a board contains a link card that points to another board, clicking it navigates to that board.

### Data Model

The fundamental data model is:

```
App State
├── boards: Board[]
│
Board
├── id: string (uuid)
├── title: string
├── createdAt: timestamp
├── modifiedAt: timestamp
├── camera: { x: number, y: number, zoom: number }
├── objects: CanvasObject[]
│
CanvasObject (base fields shared by all types)
├── id: string (uuid)
├── type: "image" | "text" | "link" | "file" | "group" | "arrow"
├── x: number (canvas coordinates)
├── y: number (canvas coordinates)
├── width: number
├── height: number
├── zIndex: number
├── locked: boolean
├── colour: string (background/accent colour for the card)
│
ImageCard extends CanvasObject
├── src: string (path or reference to stored image file)
├── originalFilename: string
├── caption: string
├── objectFit: "cover" | "contain"
│
TextCard extends CanvasObject
├── content: string (plain text, or markdown if you implement it)
├── fontSize: number
│
LinkCard extends CanvasObject
├── url: string
├── title: string (fetched or user-edited)
├── description: string (fetched or user-edited)
├── thumbnail: string (fetched preview image, optional)
├── targetBoardId: string (optional — if this links to another board)
│
FileCard extends CanvasObject
├── filePath: string (reference to stored file)
├── originalFilename: string
├── fileSize: number
├── mimeType: string
│
GroupRegion extends CanvasObject
├── label: string
├── backgroundColour: string (with alpha)
├── borderStyle: string
(Note: this is a visual region, NOT a container that parents other objects.
Objects are "in" a group only by spatial overlap, not by data relationship.
Keep it simple.)
│
Arrow extends CanvasObject
├── startX: number
├── startY: number
├── endX: number
├── endY: number
├── startObjectId: string | null (snap to object edge if set)
├── endObjectId: string | null (snap to object edge if set)
├── lineStyle: "solid" | "dashed" | "dotted"
├── arrowHead: "none" | "end" | "both"
├── curvature: number (0 = straight, positive = curved)
├── colour: string
├── strokeWidth: number
```

### Persistence

All data lives locally. No server, no cloud, no login.

The storage approach should handle:
- Many boards (dozens to low hundreds)
- Boards with dozens to a few hundred objects each
- Image files up to ~20MB each
- Total dataset potentially reaching several GB over time

Each board should be independently loadable — don't load all board data into memory at startup, just the metadata needed for the home screen. Load full object data when a board is opened.

Images and files should be stored as actual files (not base64 blobs in JSON). The board data should reference them by path or ID.

Choose whatever storage mechanism makes sense (IndexedDB, File System Access API, Origin Private File System, a hybrid approach, etc.), but optimise for:
1. Reliability — data must not be lost on browser crash
2. Speed — board open should feel instant for a board with 200 objects
3. Inspectability — ideally the user can find and back up their data

Save automatically on every change, debounced appropriately. No manual save button.

## Canvas Behaviour

### Pan and Zoom

- **Pan**: middle-mouse drag, or space + left-mouse drag, or two-finger trackpad drag
- **Zoom**: scroll wheel (or pinch on trackpad), zooming toward the cursor position
- Zoom range: roughly 10% to 500%, with smooth interpolation
- The canvas should feel responsive at 60fps during pan/zoom even with hundreds of objects on screen
- Only render objects that are within or near the current viewport (frustum culling / virtualisation)

### Camera Persistence

Each board remembers its camera position and zoom level. When you leave a board and come back, you're looking at the same spot.

### Grid and Snapping

- Optional snap-to-grid when dragging objects (togglable, off by default)
- Smart guides / snap lines when dragging near other objects' edges or centres (like Figma's alignment guides)
- These are visual aids only — objects can be placed at any position

## Object Manipulation

### Selection

- Click an object to select it (shows selection handles)
- Click empty canvas to deselect
- Shift+click to add/remove from selection
- Drag on empty canvas to draw a selection rectangle (objects fully or partially inside are selected)
- Cmd/Ctrl+A to select all objects on the board

### Moving

- Drag any selected object to move it (all selected objects move together)
- Arrow keys to nudge selected objects by 1px (or grid increment if snapping is on)
- Shift+arrow keys to nudge by 10px

### Resizing

- Selection handles on corners and edges
- Drag corners to resize while maintaining aspect ratio (for images) or freely (for text/group)
- Drag edges to resize in one dimension
- Minimum size constraint so objects don't collapse to zero

### Z-ordering

- Right-click context menu or keyboard shortcuts: bring to front, send to back, bring forward, send backward
- Newly created objects go to the top of the z-stack

### Deletion

- Select object(s), press Delete or Backspace to remove
- Confirm before deleting if multiple objects are selected (optional, could be annoying — use judgement)

### Copy / Paste

- Cmd/Ctrl+C to copy selected objects
- Cmd/Ctrl+V to paste at cursor position (or centre of viewport if cursor is outside canvas)
- Cmd/Ctrl+D to duplicate in place (offset slightly)
- Copy/paste should work for all object types including images

### Undo / Redo

- Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z to redo
- Command stack tracking all state mutations
- Undo should feel instant — store diffs or snapshots as appropriate
- Undo history doesn't need to persist across sessions (reset on board close is fine)

## Adding Content to the Canvas

All of these methods should create the appropriate card type at the drop position or centre of viewport:

### Drag and Drop from Filesystem

- Drag image files (png, jpg, gif, webp, svg) onto the canvas → creates an ImageCard
- Drag other files (pdf, docx, etc.) onto the canvas → creates a FileCard showing filename, size, and file type icon
- Drag multiple files at once → creates multiple cards, arranged in a row or grid at the drop point
- Handle large images gracefully — generate thumbnails for display, store the original

### Paste from Clipboard

- Paste an image from clipboard (e.g. screenshot) → creates an ImageCard
- Paste a URL → creates a LinkCard (attempt to fetch title/description/thumbnail)
- Paste plain text → creates a TextCard
- If ambiguous, prefer the most specific type (URL detection > plain text)

### Double-Click Empty Canvas

- Double-clicking on empty space creates a new TextCard at that position and immediately enters edit mode, so you can start typing

### Toolbar / Keyboard Shortcuts

Provide a minimal toolbar (floating or sidebar) with buttons to add:
- Text note
- Image (opens file picker)
- Link (prompts for URL)
- Arrow/line (enter arrow-drawing mode: click start point, click end point)
- Group region

Keyboard shortcuts for the most common ones:
- T → new text card
- A → enter arrow-drawing mode
- G → new group region

## Object-Specific Behaviours

### Text Cards

- Display as a card/rectangle with text inside
- Click to select the card, double-click to enter text editing mode
- In edit mode, the card shows a text cursor and accepts keyboard input
- Support basic formatting if straightforward to implement: bold, italic, bullet lists. But plain text is acceptable for MVP. Don't spend excessive time on a rich text editor.
- Auto-resize height to fit content (width is user-controlled via resize handles)
- Card should have a visible border or subtle background so it reads as a card, not floating text

### Image Cards

- Display the image filling the card area
- Object-fit "cover" by default (crops to fill), with an option to switch to "contain"
- Optional caption below the image (editable text field, can be empty)
- Double-click to open the full-resolution image in a lightbox/overlay
- Right-click context menu: "Replace image", "Remove caption", "Fit to content" (resize card to image's native aspect ratio)
- Generate and cache thumbnails for performance — don't render a 20MB image at 200px card width

### Link Cards

- Display as a card showing: page title, URL (truncated), and thumbnail/preview image if available
- When the link is first created, attempt to fetch the URL's Open Graph metadata (title, description, image) to populate the card. If fetching fails or isn't implemented, just show the raw URL. This is a nice-to-have, not a blocker.
- Clicking the link should open it in a new browser tab (not navigate away from the app)
- Special case: if a link card's targetBoardId is set, clicking it navigates to that board within the app instead of opening a browser tab

### File Cards

- Display as a card showing: file icon (based on MIME type), filename, and file size
- Double-click to open/download the file
- Don't attempt to preview file contents — just show metadata

### Group Regions

- A translucent coloured rectangle with an optional text label at the top
- Rendered behind other objects (low z-index)
- Primarily a visual organiser — "this area is for reference images", "this area is for copy"
- Should be resizable and movable like any other object
- Label is editable (double-click)

### Arrows / Lines

- Connect two points on the canvas
- Can optionally snap to object edges — if an arrow's start or end is attached to an object, it should visually connect to the nearest edge/anchor point of that object and follow when the object moves
- Drawing mode: click first point (or click on an object to attach), then click second point (or second object)
- Once drawn, you can select an arrow and drag its endpoints to reposition
- Right-click or property panel to change: line style (solid/dashed/dotted), arrowhead (none/end/both), colour, stroke width
- Curved arrows: allow some control over curvature, either via a drag handle on the midpoint or a property slider

## UI Layout

### Board View Layout

- The canvas occupies the full window
- A narrow top bar with: back/home button, board title (editable inline), and a few global controls (zoom level indicator, grid toggle)
- A floating toolbar on the left or bottom with add-object buttons
- A context-sensitive property panel on the right that appears when an object is selected, showing editable properties for that object type (colour, font size, line style, etc.). Hidden when nothing is selected to maximise canvas space.
- Right-click context menu on objects with common actions (delete, duplicate, bring to front, lock/unlock, etc.)
- Right-click context menu on empty canvas with: paste, add text, add image, add link, zoom to fit

### Home View Layout

- Simple grid of board thumbnails with titles and dates
- "New Board" button prominently placed
- Right-click on board thumbnail: rename, duplicate, delete
- Search/filter if there are many boards (nice to have)
- Board thumbnails should be auto-generated previews of the board content, not placeholder icons. This can be a miniature render of the board or a snapshot. If too complex, a coloured placeholder with the title is acceptable for MVP.

## Keyboard Shortcuts Summary

| Shortcut | Action |
|---|---|
| Space + drag | Pan canvas |
| Scroll wheel | Zoom |
| Cmd/Ctrl + A | Select all |
| Delete / Backspace | Delete selected |
| Cmd/Ctrl + C | Copy |
| Cmd/Ctrl + V | Paste |
| Cmd/Ctrl + D | Duplicate |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + 0 | Reset zoom to 100% |
| Cmd/Ctrl + Shift + 0 | Zoom to fit all content |
| Arrow keys | Nudge selected 1px |
| Shift + Arrow keys | Nudge selected 10px |
| T | New text card |
| A | Arrow drawing mode |
| G | New group region |
| Escape | Deselect / exit current mode |
| Double-click empty area | New text card at cursor |

## Visual Design

- Clean, minimal, neutral. Light grey canvas background with a subtle dot grid (optional, togglable).
- Cards should have a white background, subtle shadow or border, and slightly rounded corners. They should look like physical cards on a surface.
- Selected objects get a blue outline and visible resize handles.
- Hover states on interactive elements.
- The app should not look like a developer tool. It should feel calm and slightly polished — closer to Milanote or Apple Notes than to a code editor.
- Dark mode support is a nice-to-have, not MVP.

## Performance Requirements

- Pan and zoom must be 60fps with 200+ objects on a board
- Virtualise rendering: don't render objects outside the viewport
- Thumbnail/downscale images for canvas display — never render full-resolution images at small card sizes
- Debounce persistence writes so rapid dragging doesn't hammer storage
- Board list should load in under 1 second even with 100+ boards

## What Not To Build

Do not implement any of the following. They are out of scope:

- Multi-user / collaboration / sharing
- User accounts or authentication
- Cloud sync or any server component
- Mobile/touch support (desktop browser only)
- Export to PDF/PNG/etc.
- Import from other tools
- Templates or prebuilt board layouts
- Web clipper browser extension
- Video embeds
- Version history / time travel
- Comments or annotations system
- Search across boards (searching within a single board is fine)
- Nested boards / boards-within-boards (linking between boards is sufficient)
- Offline service worker caching (the app is already local)

## Definition of Done

The app is done when:

1. You can create, rename, and delete boards from a home screen
2. You can open a board and pan/zoom around an infinite canvas
3. You can add text cards, image cards, link cards, file cards, and group regions
4. You can drag content from the filesystem onto the canvas to create cards
5. You can paste images, text, and URLs from the clipboard
6. You can select, move, resize, and delete any object
7. You can draw arrows between objects and they follow when objects move
8. You can multi-select objects and manipulate them as a group
9. All data persists locally and survives browser restart
10. Undo/redo works for all operations
11. The app feels responsive and visually clean

Items 1-9 are hard requirements. Items 10-11 are strongly desired but the app is usable without perfect implementations of them.
