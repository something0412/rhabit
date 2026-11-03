"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  expandedWidth?: string; // how wide it opens, e.g. "18rem"
}

// A round search button that grows into a search box (layout based on a reUI pattern).
//  - click it, or press Ctrl+K (Cmd+K on a Mac), to open it
//  - Esc clears it and closes it; clicking away closes it when it's empty
// The page keeps the text (value/onChange) and does the filtering itself.
export function SearchBar({ value, onChange, placeholder = "Search...", expandedWidth = "18rem" }: Props) {
  const [open, setOpen] = useState(value !== "");
  const [shortcutKey, setShortcutKey] = useState("Ctrl"); // becomes "⌘" on a Mac
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLFormElement>(null);

  // Which key to show in the hint (only the browser knows, so check after the page loads)
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutKey("⌘");
  }, []);

  // Put the cursor in the box as soon as it opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Ctrl+K / Cmd+K opens it from anywhere on the page
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); // the browser has its own Ctrl+K; ours wins on this page
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clicking somewhere else closes it, but only if nothing is typed (so the filter isn't hidden)
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (value === "" && !boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [value]);

  function clear() {
    onChange("");
    inputRef.current?.focus();
  }

  return (
    <motion.form
      ref={boxRef}
      role="search"
      onSubmit={(e) => e.preventDefault()} // results update while you type, Enter does nothing extra
      onClick={() => !open && setOpen(true)}
      initial={false}
      animate={{ width: open ? expandedWidth : "2.5rem" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative flex h-10 shrink-0 items-center overflow-hidden rounded-full border shadow-sm transition-colors ${
        open ? "border-line bg-surface" : "cursor-pointer border-transparent bg-subtle hover:bg-line"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // don't let the form's onClick open it again
          if (open && value === "") setOpen(false);
          else setOpen(true);
        }}
        aria-label={open ? "Close search" : "Search"}
        className="absolute left-0 z-10 flex h-full w-10 items-center justify-center text-muted transition-colors hover:text-ink"
      >
        <Search className="h-4 w-4" />
      </button>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        tabIndex={open ? 0 : -1}
        className={`h-full w-full bg-transparent pr-10 pl-10 text-sm text-ink outline-none placeholder:text-muted/60 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <AnimatePresence>
        {/* empty: show the keyboard shortcut. Something typed: show an X to clear it */}
        {open && value === "" && (
          <motion.span
            key="hint"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute right-3 flex h-5 items-center rounded bg-subtle px-1.5 text-[10px] font-medium text-muted"
          >
            {shortcutKey} K
          </motion.span>
        )}
        {open && value !== "" && (
          <motion.button
            key="clear"
            type="button"
            onClick={clear}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            aria-label="Clear search"
            className="absolute right-0 flex h-full w-10 items-center justify-center text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
