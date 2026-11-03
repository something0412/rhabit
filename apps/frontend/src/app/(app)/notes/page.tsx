"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Inbox, Pin } from "lucide-react";
import type { BucketItem, Note } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { isOurDrag, readDragData } from "@/lib/dragData";
import { localDate } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { NoteCard } from "@/components/notes/NoteCard";
import { BucketList } from "@/components/bucket/BucketList";
import { HoloButton } from "@/components/common/HoloButton";

export default function NotesPage() {
  const { notify } = useNotifications();
  const [notes, setNotes] = useState<Note[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dragOverBucket, setDragOverBucket] = useState(false);
  const [dragOverList, setDragOverList] = useState(false);
  const [showAssigned, setShowAssigned] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      try {
        const notesRes = await api.get<Note[]>("/notes");
        const bucketRes = await api.get<BucketItem[]>("/bucket");
        setNotes(notesRes.data);
        setBucket(bucketRes.data);
      } catch (error) {
        notify("danger", "Couldn't load notes", errorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, []);

  // The bucket depends on notes (and the schedule), so ask the server for the fresh list
  async function reloadBucket() {
    try {
      const res = await api.get<BucketItem[]>("/bucket");
      setBucket(res.data);
    } catch (error) {
      notify("danger", "Couldn't load the bucket", errorMessage(error));
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    try {
      const res = await api.post<Note>("/notes", { title, details });
      setNotes([res.data, ...notes]);
      setTitle("");
      setDetails("");
    } catch (error) {
      notify("danger", "Couldn't add note", errorMessage(error));
    }
  }

  function noteChanged(changed: Note) {
    setNotes(notes.map((n) => (n.id === changed.id ? changed : n)));
    reloadBucket();
  }

  function noteDeleted(noteId: number) {
    setNotes(notes.filter((n) => n.id !== noteId));
    reloadBucket();
  }

  // ----- drag a note INTO the bucket -----
  async function dropOnBucket(event: React.DragEvent) {
    event.preventDefault();
    setDragOverBucket(false);
    const dragged = readDragData(event);
    if (dragged?.kind !== "note") return;

    try {
      const res = await api.patch<Note>(`/notes/${dragged.id}`, { in_bucket: true });
      noteChanged(res.data);
    } catch (error) {
      notify("danger", "Couldn't move it to the bucket", errorMessage(error));
    }
  }

  // ----- drag a note OUT of the bucket, back into the list -----
  async function dropOnList(event: React.DragEvent) {
    event.preventDefault();
    setDragOverList(false);
    const dragged = readDragData(event);
    if (dragged?.kind !== "bucket" || dragged.source !== "note") return;
    await removeFromBucket({ source: "note", id: dragged.id });
  }

  // × on a bucket item: a note goes back to the list, a scheduled task is ignored
  async function removeFromBucket(item: Pick<BucketItem, "source" | "id">) {
    try {
      const res = await api.post<BucketItem[]>("/bucket/remove", { source: item.source, id: item.id });
      setBucket(res.data);
      if (item.source === "note") setNotes(notes.map((n) => (n.id === item.id ? { ...n, in_bucket: false } : n)));
    } catch (error) {
      notify("danger", "Couldn't remove it", errorMessage(error));
    }
  }

  function bucketDetailsSaved(item: BucketItem, newDetails: string) {
    setBucket(bucket.map((b) => (b.source === item.source && b.id === item.id ? { ...b, details: newDetails } : b)));
    if (item.source === "note") setNotes(notes.map((n) => (n.id === item.id ? { ...n, details: newDetails } : n)));
  }

  // Each note lives in exactly ONE place:
  //  - open list:  not done, not in the bucket, not assigned yet
  //  - bucket:     shown in the bucket box
  //  - assigned:   already became a task in a day's plan (can't be bucketed again)
  //  - done
  const openNotes = notes.filter((n) => !n.done && !n.in_bucket && !n.added_to_date);
  const assignedNotes = notes.filter((n) => !n.done && n.added_to_date);
  const doneNotes = notes.filter((n) => n.done);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Notes</h1>
        <p className="text-sm text-muted">
          Side to-dos without timers. Drag one into the bucket to add it to a day&apos;s plan from the Main tab.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-[1fr_18rem]">
        {/* ----- left: the notes ----- */}
        <div className="flex flex-col gap-4">
          <form onSubmit={addNote} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Do laundry"
                required
                className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              <HoloButton type="submit">
                Add
              </HoloButton>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Details (optional), e.g. whites only"
              rows={1}
              className="resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </form>

          <ul
            onDragOver={(e) => {
              if (!isOurDrag(e)) return;
              e.preventDefault();
              setDragOverList(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverList(false);
            }}
            onDrop={dropOnList}
            className={`flex min-h-24 flex-col gap-2 rounded-xl p-1 transition ${dragOverList ? "bg-accent-soft" : ""}`}
          >
            {loading && <p className="text-sm text-muted">Loading...</p>}
            {!loading && openNotes.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                No open notes. Add one above.
              </p>
            )}
            {openNotes.map((note) => (
              <NoteCard key={note.id} note={note} onChanged={noteChanged} onDeleted={noteDeleted} />
            ))}
          </ul>

          {doneNotes.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Done</h2>
              <ul className="flex flex-col gap-2">
                {doneNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onChanged={noteChanged} onDeleted={noteDeleted} />
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ----- right: the to-do bucket, and below it the assigned notes -----
            Each box has a max height and scrolls inside, so a long list never runs off the screen:
            bucket = up to 2/3 of the screen, assigned = up to 1/3. (10rem = the page title, page padding and
            gaps, taken off first so both boxes together fit on the screen even before you scroll.) */}
        <div className="flex flex-col gap-4 @3xl:sticky @3xl:top-6">
          <section
            onDragOver={(e) => {
              if (!isOurDrag(e)) return;
              e.preventDefault();
              setDragOverBucket(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverBucket(false);
            }}
            onDrop={dropOnBucket}
            className={`flex max-h-[calc((100vh-10rem)*2/3)] flex-col rounded-xl border-2 border-dashed p-3 transition ${
              dragOverBucket ? "border-accent bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Inbox className="h-4 w-4" aria-hidden /> To-do bucket
            </h2>
            <p className="mb-3 text-xs text-muted">Drop notes here. Scheduled tasks show up here on their day.</p>

            {bucket.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Empty. Drag a note here.</p>
            ) : (
              // min-h-0 + flex-1: this part takes the space left in the box and scrolls (the title stays put)
              <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                <BucketList items={bucket} today={localDate()} onRemove={removeFromBucket} onDetailsSaved={bucketDetailsSaved} />
              </div>
            )}
          </section>

          <section className="flex max-h-[calc((100vh-10rem)/3)] flex-col rounded-xl border border-line bg-surface">
            <button
              onClick={() => setShowAssigned(!showAssigned)}
              aria-expanded={showAssigned}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Pin className="h-4 w-4" aria-hidden /> Assigned <span className="font-normal text-muted">({assignedNotes.length})</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showAssigned ? "rotate-180" : ""}`} aria-hidden />
            </button>

            {showAssigned && (
              // scrolls inside the box; the "Assigned" header stays put
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-line p-3 [scrollbar-gutter:stable]">
                <p className="mb-3 text-xs text-muted">
                  Notes already added to a day&apos;s plan. Delete the task from the plan to get the note back.
                </p>
                {assignedNotes.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted">Nothing assigned yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {assignedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onChanged={noteChanged} onDeleted={noteDeleted} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
