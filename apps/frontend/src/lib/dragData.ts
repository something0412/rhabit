import type { BucketSource } from "@productivity/shared";

// Drag and drop uses the browser's built-in support:
//   <div draggable onDragStart={(e) => setDragData(e, {...})}>   the thing you pick up
//   <div onDragOver={...} onDrop={(e) => readDragData(e)}>        the place you drop it
// We pass a small JSON message saying WHAT is being dragged.

const DRAG_TYPE = "application/x-productivity-item";

export type DragData =
  | { kind: "note"; id: number } // a note from the Notes list
  | { kind: "bucket"; source: BucketSource; id: number } // an item from the to-do bucket
  | { kind: "task"; id: number }; // a task on the Main tab (to reorder it)

// While dragging, the browser hides the message until the drop.
// We also keep a copy here, so drop zones can check what's coming (e.g. to show a drop line).
let currentDrag: DragData | null = null;

export function setDragData(event: React.DragEvent, data: DragData) {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(data));
  event.dataTransfer.effectAllowed = "move";
  currentDrag = data;
}

// Call this in onDragEnd (the drag finished, dropped or cancelled)
export function clearDragData() {
  currentDrag = null;
}

// What is being dragged right now (or null)
export function getCurrentDrag(): DragData | null {
  return currentDrag;
}

export function readDragData(event: React.DragEvent): DragData | null {
  try {
    return JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
  } catch {
    return null; // something else was dropped (a file, some text...)
  }
}

// While dragging (before the drop) the browser hides the data, but we can check its type
export function isOurDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(DRAG_TYPE);
}
