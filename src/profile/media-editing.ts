import {
  validatePhotoDetails,
  type MediaFiles,
  type PhotoSource,
  type ProgressPhoto,
} from "./media-model.ts";
import type { createProfileMediaPersistence } from "./media-persistence.ts";

type MediaStore = ReturnType<typeof createProfileMediaPersistence>;
export type MediaEditAttempt =
  | Readonly<{ kind: "closed" }>
  | Readonly<{ kind: "avatar"; id: number; source?: PhotoSource }>
  | Readonly<{
      kind: "photo";
      id: number;
      photo?: ProgressPhoto;
      source?: PhotoSource;
      date: string;
      note: string;
    }>;
export type MediaEditSnapshot = Readonly<{
  attempt: MediaEditAttempt;
  phase: "idle" | "picking" | "saving";
  busy: boolean;
  ready: boolean;
  error: string | null;
}>;
type Ticket = { lifecycle: number; attempt: MediaEditAttempt; source?: PhotoSource };

export function createMediaEditing({
  mode,
  media,
  files,
  pick,
  today,
}: {
  mode: "avatar" | "photos";
  media: Pick<
    MediaStore,
    "getSnapshot" | "subscribe" | "saveAvatar" | "addPhoto" | "updatePhoto" | "removePhoto"
  >;
  files: Pick<MediaFiles, "releaseUri">;
  pick: (origin: "library" | "camera", avatar: boolean) => Promise<PhotoSource | null>;
  today: () => string;
}) {
  let snapshot: MediaEditSnapshot = {
    attempt: { kind: "closed" },
    phase: "idle",
    error: null,
    busy: media.getSnapshot().saving,
    ready: media.getSnapshot().state.kind === "ready",
  };
  const listeners = new Set<() => void>();
  const released = new WeakSet<PhotoSource>();
  let active = false,
    lifecycle = 0,
    sequence = 0,
    notifying = false;
  let pending: Ticket | null = null;
  let unsubscribe: (() => void) | null = null;

  function publish(patch: Partial<MediaEditSnapshot>) {
    const durable = media.getSnapshot();
    const next = {
      ...snapshot,
      ...patch,
      busy: (patch.phase ?? snapshot.phase) !== "idle" || durable.saving,
      ready: durable.state.kind === "ready",
    };
    if (
      next.attempt === snapshot.attempt &&
      next.phase === snapshot.phase &&
      next.error === snapshot.error &&
      next.busy === snapshot.busy &&
      next.ready === snapshot.ready
    )
      return;
    snapshot = Object.freeze({
      ...next,
      attempt: patch.attempt ? Object.freeze(patch.attempt) : snapshot.attempt,
    });
    const previous = notifying;
    notifying = true;
    try {
      for (const listener of listeners) listener();
    } finally {
      notifying = previous;
    }
  }
  function release(source: PhotoSource | undefined) {
    if (!source || released.has(source)) return;
    released.add(source);
    try {
      files.releaseUri(source.uri);
    } catch {
      /* Retirement must not reopen an edit. */
    }
  }
  function sourceOf(attempt: MediaEditAttempt) {
    return attempt.kind === "closed" ? undefined : attempt.source;
  }
  function retireSource(attempt: MediaEditAttempt) {
    const source = sourceOf(attempt);
    // An import may still be reading this source after its editor has left.
    if (source !== pending?.source) release(source);
  }
  function available() {
    const durable = media.getSnapshot();
    return active && !notifying && !pending && !durable.saving && durable.state.kind === "ready";
  }
  function current(ticket: Ticket) {
    return active && ticket.lifecycle === lifecycle && snapshot.attempt === ticket.attempt;
  }
  function begin(phase: "picking" | "saving") {
    const ticket: Ticket = {
      lifecycle,
      attempt: snapshot.attempt,
      source: sourceOf(snapshot.attempt),
    };
    pending = ticket;
    publish({ phase, error: null });
    return ticket;
  }
  function finish(ticket: Ticket) {
    if (pending !== ticket) return;
    pending = null;
    if (sourceOf(snapshot.attempt) !== ticket.source) release(ticket.source);
    if (active) publish({ phase: "idle" });
  }
  function close() {
    retireSource(snapshot.attempt);
    publish({ attempt: { kind: "closed" }, phase: "idle", error: null });
  }
  async function commit(remove: boolean) {
    if (!available() || snapshot.attempt.kind === "closed") return false;
    const attempt = snapshot.attempt;
    // Reserve before validation feedback: observers cannot start another command.
    const ticket: Ticket = { lifecycle, attempt, source: sourceOf(attempt) };
    pending = ticket;
    try {
      if (!remove && attempt.kind === "photo") {
        try {
          validatePhotoDetails(attempt.date, attempt.note);
        } catch {
          publish({
            error: "Enter a valid date as YYYY-MM-DD and a note of 2,000 characters or fewer.",
          });
          return false;
        }
        if (!attempt.photo && !attempt.source) {
          publish({ error: "Choose a photo first." });
          return false;
        }
      }
      if (attempt.kind === "avatar" && !remove && !attempt.source) return false;
      if (attempt.kind === "photo" && remove && !attempt.photo) return false;
      if (!current(ticket)) return false;
      // Reserve the real durable mutation before notifying edit observers. A
      // subscriber can call the shared store directly, outside this owner.
      const writing =
        attempt.kind === "avatar"
          ? media.saveAvatar(remove ? null : attempt.source!)
          : remove
            ? media.removePhoto(attempt.photo!.id)
            : attempt.photo
              ? media.updatePhoto({
                  id: attempt.photo.id,
                  date: attempt.date,
                  note: attempt.note,
                  source: attempt.source,
                })
              : media.addPhoto({ source: attempt.source!, date: attempt.date, note: attempt.note });
      if (current(ticket)) publish({ phase: "saving", error: null });
      const saved = await writing;
      if (current(ticket)) {
        if (saved) close();
        else
          publish({
            error: media.getSnapshot().error || "Couldn't save your photo changes. Try again.",
          });
      }
      return saved;
    } catch {
      if (current(ticket)) publish({ error: "Couldn't save your photo changes. Try again." });
      return false;
    } finally {
      finish(ticket);
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (active) return;
      active = true;
      ++lifecycle;
      unsubscribe = media.subscribe(() => publish({}));
      publish({});
    },
    stop() {
      if (!active) return;
      active = false;
      const stopped = ++lifecycle;
      unsubscribe?.();
      unsubscribe = null;
      // React rehearses effect cleanup/setup synchronously in StrictMode. A real
      // detach retires after that rehearsal window, preserving the same draft.
      void Promise.resolve().then(() => {
        if (!active && lifecycle === stopped) close();
      });
    },
    open(photo?: ProgressPhoto) {
      if (!active || notifying) return false;
      retireSource(snapshot.attempt);
      publish({
        attempt:
          mode === "avatar"
            ? { kind: "avatar", id: ++sequence }
            : {
                kind: "photo",
                id: ++sequence,
                photo: photo
                  ? Object.freeze({ ...photo, image: Object.freeze({ ...photo.image }) })
                  : undefined,
                date: photo?.date ?? today(),
                note: photo?.note ?? "",
              },
        error: null,
      });
      return true;
    },
    change(change: { date?: string; note?: string }) {
      if (!available() || snapshot.attempt.kind !== "photo") return false;
      publish({ attempt: { ...snapshot.attempt, ...change }, error: null });
      return true;
    },
    cancel() {
      if (!active || notifying || pending) return false;
      close();
      return true;
    },
    async pick(origin: "library" | "camera") {
      if (!available() || (mode === "avatar" && snapshot.attempt.kind !== "avatar")) return false;
      const ticket = begin("picking");
      try {
        if (!current(ticket)) return false;
        const selected = await pick(origin, mode === "avatar");
        if (!selected) return false;
        if (!current(ticket)) {
          release(selected);
          return false;
        }
        const source = Object.freeze({ ...selected });
        const attempt = snapshot.attempt;
        publish({
          attempt:
            attempt.kind === "closed"
              ? { kind: "photo", id: ++sequence, source, date: today(), note: "" }
              : { ...attempt, source },
        });
        return true;
      } catch {
        if (current(ticket)) publish({ error: "Couldn't open your photo. Try again." });
        return false;
      } finally {
        finish(ticket);
      }
    },
    save: () => commit(false),
    remove: () => commit(true),
  };
}
export type MediaEditing = ReturnType<typeof createMediaEditing>;
