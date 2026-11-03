import { useEffect, useState } from "react";

// The "scroll focus" effect (from a reUI scroll-list, toned down), used by the task list and the
// notification column. While a list scrolls, the item at the "focus line" is full size and the others
// are a bit smaller and faded.
//
// The focus line slides from the top of the box (scrolled to the top) to the bottom (scrolled to the
// end), so the first item is in focus at the top and the last one at the end.
//
// How to use it:
//   1. Put a ref on the scrolling box, and give it `relative` (positions are measured from its top).
//   2. Give each item a data-focus-index={index} attribute.
//   3. const focusedIndex = useScrollFocus(listRef, items.length);
//      (the 2nd value just has to change whenever the items change, e.g. the count, or "date-count")
//   4. Animate each item with focusLook(...) (see below).
// focusedIndex is null when everything fits (nothing to scroll): then every item is full size.
export function useScrollFocus(listRef: React.RefObject<HTMLElement | null>, contentKey: number | string): number | null {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function updateFocus() {
      if (!list) return;
      const scrollRoom = list.scrollHeight - list.clientHeight;
      if (scrollRoom <= 1) {
        setFocusedIndex(null); // everything fits: no effect
        return;
      }
      const progress = list.scrollTop / scrollRoom; // 0 = at the top ... 1 = at the end
      const focusLine = list.scrollTop + list.clientHeight * progress;

      let closest: number | null = null;
      let closestDistance = Infinity;
      for (const item of list.querySelectorAll<HTMLElement>("[data-focus-index]")) {
        const itemCenter = item.offsetTop + item.offsetHeight / 2;
        const distance = Math.abs(itemCenter - focusLine);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = Number(item.dataset.focusIndex);
        }
      }
      setFocusedIndex(closest);
    }

    updateFocus();
    list.addEventListener("scroll", updateFocus);

    // Also re-check when the box or an item changes size, e.g. a new notification growing into place,
    // a task's details opening, or the window resizing. (ResizeObserver = "tell me when this changes size")
    const sizeWatcher = new ResizeObserver(updateFocus);
    sizeWatcher.observe(list);
    for (const item of list.querySelectorAll("[data-focus-index]")) sizeWatcher.observe(item);

    return () => {
      list.removeEventListener("scroll", updateFocus);
      sizeWatcher.disconnect();
    };
  }, [listRef, contentKey]);

  return focusedIndex;
}

// How an item looks, by how far it is from the focused one:
// focused = full size, next to it = almost, further away = a bit smaller and faded.
export function focusLook(index: number, focusedIndex: number | null): { scale: number; opacity: number } {
  if (focusedIndex === null) return { scale: 1, opacity: 1 };
  const distance = Math.abs(index - focusedIndex);
  if (distance === 0) return { scale: 1, opacity: 1 };
  if (distance === 1) return { scale: 0.985, opacity: 0.9 };
  return { scale: 0.97, opacity: 0.65 };
}
