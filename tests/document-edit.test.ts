import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentEdit, type ParsedDraft } from "../src/persistence/document-edit.ts";
import { createDurableWrite, type DurableStorage } from "../src/persistence/durable-write.ts";

// A labelled counter stands in for any durable domain document. The edit owns
// only the label, so Save must merge it into the latest saved document.
type Labelled = { label: string; count: number };
const key = "test-labelled";
const encode = (label: string, count = 1) => JSON.stringify({ label, count });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function parseLabelled(raw: string | null): Labelled {
  const value: unknown = raw === null ? { label: "", count: 0 } : JSON.parse(raw);
  if (
    typeof value !== "object" ||
    value === null ||
    !("label" in value) ||
    typeof value.label !== "string" ||
    !("count" in value) ||
    typeof value.count !== "number"
  )
    throw new Error("Invalid labelled document");
  return { label: value.label, count: value.count };
}
function memory(initial: string | null = encode("Saved")) {
  let raw = initial;
  const calls: string[] = [];
  const external = new Set<() => void>();
  const storage: DurableStorage = {
    async getItem(name) {
      assert.equal(name, key);
      calls.push("read");
      return raw;
    },
    async setItem(name, value) {
      assert.equal(name, key);
      calls.push("write");
      raw = value;
    },
    subscribeItem(name, listener) {
      assert.equal(name, key);
      external.add(listener);
      return () => {
        external.delete(listener);
      };
    },
  };
  const durable = createDurableWrite({ storage, key, parse: parseLabelled });
  const document = {
    ...durable,
    async setLabelled(next: Labelled) {
      return (
        (await durable.update(
          () => ({ document: next, value: true }),
          "Couldn't save the label.",
        )) === true
      );
    },
  };
  return {
    document,
    storage,
    calls,
    raw: () => (raw === null ? null : parseLabelled(raw)),
    // Another device replaces the durable document and notifies this one.
    async replace(next: string) {
      raw = next;
      for (const listener of external) listener();
      await flush();
    },
    holdWrite() {
      const gate = deferred();
      const write = storage.setItem;
      storage.setItem = async (name, value) => {
        await gate.promise;
        await write(name, value);
      };
      return gate;
    },
    holdRead() {
      const gate = deferred();
      const read = storage.getItem;
      storage.getItem = async (name) => {
        await gate.promise;
        return read(name);
      };
      return gate;
    },
  };
}
async function ready(initial?: string | null) {
  const store = memory(initial);
  store.document.start();
  await flush();
  assert.equal(store.document.getSnapshot().state.kind, "ready");
  return store;
}
function labelEdit(
  { document }: ReturnType<typeof memory>,
  options: { follow?: boolean; write?: (next: Labelled) => Promise<boolean> } = {},
) {
  return createDocumentEdit({
    document,
    draft: "",
    seed: (saved) => saved.label,
    follow: options.follow,
    parse(draft, latest): ParsedDraft<Labelled> {
      const label = draft.trim();
      return label ? { value: { ...latest, label } } : { error: "Enter a label." };
    },
    write: options.write ?? document.setLabelled,
    failure: "Label not saved.",
  });
}
function started(
  store: ReturnType<typeof memory>,
  options?: Parameters<typeof labelEdit>[1],
): ReturnType<typeof labelEdit> {
  const edit = labelEdit(store, options);
  edit.start();
  return edit;
}

test("construction is inert, snapshots are stable, and commands wait for start", async () => {
  const store = memory();
  const edit = labelEdit(store);
  const initial = edit.getSnapshot();
  assert.equal(edit.getSnapshot(), initial);
  assert.deepEqual(initial, {
    draft: "",
    error: null,
    busy: false,
    saving: false,
    saved: false,
    load: { kind: "loading" },
  });
  let notifications = 0;
  edit.subscribe(() => {
    notifications++;
  });
  assert.equal(edit.change("Early"), false);
  assert.equal(edit.cancel(), false);
  assert.equal(await edit.save(), false);
  assert.deepEqual(store.calls, []);
  assert.equal(notifications, 0);
  store.document.start();
  await flush();
  // A stopped edit does not observe the document until it starts.
  assert.equal(edit.getSnapshot(), initial);
  edit.start();
  edit.start();
  assert.equal(edit.getSnapshot().draft, "Saved");
  assert.equal(edit.getSnapshot().load.kind, "ready");
  assert.equal(notifications, 1);
});

test("a filled draft fills once from a late read and never replaces entered text", async () => {
  const store = memory();
  const read = store.holdRead();
  store.document.start();
  const untouched = started(store);
  const typed = started(store);
  assert.equal(untouched.getSnapshot().draft, "");
  assert.equal(untouched.getSnapshot().load.kind, "loading");
  assert.equal(await untouched.save(), false);
  assert.equal(typed.change("Typed early"), true);
  read.resolve();
  await flush();
  await flush();
  assert.equal(untouched.getSnapshot().draft, "Saved");
  assert.equal(untouched.getSnapshot().load.kind, "ready");
  assert.equal(typed.getSnapshot().draft, "Typed early");
  await store.replace(encode("Remote"));
  assert.equal(untouched.getSnapshot().draft, "Saved");
  assert.equal(started(store).getSnapshot().draft, "Remote");
});

test("a following draft tracks saved replacements until the user types; cancel resumes it", async () => {
  const store = await ready();
  const edit = started(store, { follow: true });
  assert.equal(edit.getSnapshot().draft, "Saved");
  await store.replace(encode("Remote"));
  assert.equal(edit.getSnapshot().draft, "Remote");
  assert.equal(edit.change("Mine"), true);
  await store.replace(encode("Again"));
  assert.equal(edit.getSnapshot().draft, "Mine");
  // A full reload hides the document; the entered draft survives until it returns.
  store.document.stop();
  store.document.start();
  assert.equal(edit.getSnapshot().load.kind, "loading");
  assert.equal(edit.getSnapshot().draft, "Mine");
  await flush();
  assert.equal(edit.getSnapshot().draft, "Mine");
  assert.equal(edit.cancel(), true);
  assert.equal(edit.getSnapshot().draft, "Again");
  await store.replace(encode("Latest"));
  assert.equal(edit.getSnapshot().draft, "Latest");
});

test("validation feedback stays until the draft changes and never writes", async () => {
  const store = await ready();
  const edit = started(store);
  edit.change("   ");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Enter a label.");
  assert.equal(edit.getSnapshot().busy, false);
  edit.change(" ");
  assert.equal(edit.getSnapshot().error, null);
  // Domain feedback can be structured, such as per-field messages.
  const fields = createDocumentEdit({
    document: store.document,
    draft: "",
    seed: (saved) => saved.label,
    parse: (): ParsedDraft<Labelled, { label: string }> => ({ error: { label: "Required" } }),
    write: store.document.setLabelled,
    failure: "Label not saved.",
  });
  fields.start();
  assert.equal(await fields.save(), false);
  assert.deepEqual(fields.getSnapshot().error, { label: "Required" });
  assert.deepEqual(store.calls, ["read"]);
});

test("Save parses the draft against the latest saved document", async () => {
  const store = await ready(encode("Saved", 1));
  const edit = started(store);
  edit.change("Mine");
  assert.equal(await store.document.setLabelled({ label: "Saved", count: 2 }), true);
  await store.replace(encode("Remote", 3));
  assert.equal(edit.getSnapshot().draft, "Mine");
  assert.equal(await edit.save(), true);
  assert.deepEqual(store.raw(), { label: "Mine", count: 3 });
});

test("duplicate saves write once and every edit of the document waits for the write", async () => {
  const store = await ready();
  const edit = started(store, { follow: true });
  const other = started(store, { follow: true });
  const filled = started(store);
  filled.change("Typed");
  edit.change("First");
  const gate = store.holdWrite();
  const pending = edit.save();
  assert.equal(await edit.save(), false);
  assert.equal(await other.save(), false);
  assert.equal(edit.change("Second"), false);
  assert.equal(other.change("Second"), false);
  assert.equal(edit.cancel(), false);
  for (const each of [edit, other, filled]) {
    assert.equal(each.getSnapshot().busy, true);
    assert.equal(each.getSnapshot().saving, true);
  }
  // Discarding needs no write: another edit restarts from the saved document.
  assert.equal(filled.cancel(), true);
  assert.equal(filled.getSnapshot().draft, "Saved");
  assert.equal(edit.getSnapshot().draft, "First");
  assert.equal(store.raw()?.label, "Saved");
  gate.resolve();
  assert.equal(await pending, true);
  assert.deepEqual(store.calls, ["read", "write"]);
  assert.equal(edit.getSnapshot().busy, false);
  assert.equal(other.getSnapshot().draft, "First");
  assert.equal(other.getSnapshot().saved, false);
  assert.equal(filled.getSnapshot().draft, "Saved");
});

test("Save reserves persistence before observers can issue competing commands", async () => {
  const store = await ready();
  const edit = started(store);
  edit.change("Owner");
  let observed = false;
  const competing: Promise<boolean>[] = [];
  edit.subscribe(() => {
    if (observed || !edit.getSnapshot().busy) return;
    observed = true;
    assert.equal(edit.change("Intruder"), false);
    assert.equal(edit.cancel(), false);
    competing.push(edit.save(), store.document.setLabelled({ label: "Intruder", count: 9 }));
  });
  assert.equal(await edit.save(), true);
  assert.equal(observed, true);
  assert.deepEqual(await Promise.all(competing), [false, false]);
  assert.deepEqual(store.raw(), { label: "Owner", count: 1 });
  assert.deepEqual(store.calls, ["read", "write"]);
});

test("feedback publication rejects a synchronous observer retry", async () => {
  const store = await ready();
  const edit = started(store);
  edit.change("");
  let notifications = 0;
  let retry: Promise<boolean> | null = null;
  edit.subscribe(() => {
    notifications++;
    retry = edit.save();
  });
  assert.equal(await edit.save(), false);
  assert.equal(await retry, false);
  assert.equal(notifications, 1);
  assert.deepEqual(store.calls, ["read"]);
  edit.change("Retry later");
  assert.equal(await edit.save(), true);
});

test("a failed save keeps its draft and feedback; a new edit starts clean and retry succeeds", async () => {
  const store = await ready();
  const write = store.storage.setItem;
  store.storage.setItem = async () => {
    throw new Error("disk full");
  };
  const failed = started(store);
  failed.change("Retry me");
  assert.equal(await failed.save(), false);
  // Durable feedback wins over the edit's fallback message.
  assert.equal(failed.getSnapshot().error, "Couldn't save the label.");
  assert.equal(failed.getSnapshot().draft, "Retry me");
  assert.equal(failed.getSnapshot().busy, false);
  assert.equal(store.raw()?.label, "Saved");
  const fresh = started(store);
  assert.equal(store.document.getSnapshot().error, "Couldn't save the label.");
  assert.equal(fresh.getSnapshot().error, null);
  store.storage.setItem = write;
  const retry = failed.save();
  assert.equal(failed.getSnapshot().error, null);
  assert.equal(await retry, true);
  assert.equal(failed.getSnapshot().error, null);
  assert.equal(store.raw()?.label, "Retry me");
});

test("a write that fails without persistence feedback reports the edit's fallback", async () => {
  const store = await ready();
  for (const write of [async () => false, () => Promise.reject(new Error("unavailable"))]) {
    const edit = started(store, { write });
    edit.change("Lost");
    assert.equal(await edit.save(), false);
    assert.equal(edit.getSnapshot().error, "Label not saved.");
    assert.equal(edit.getSnapshot().busy, false);
  }
});

for (const succeeds of [true, false]) {
  test(`a stopped edit's late ${succeeds ? "success" : "failure"} reports nothing to it or a newer edit`, async () => {
    const store = await ready();
    const edit = started(store, { follow: true });
    edit.change("Departed");
    const gate = store.holdWrite();
    const pending = edit.save();
    edit.stop();
    edit.stop();
    const newer = started(store, { follow: true });
    assert.equal(newer.getSnapshot().busy, true);
    assert.equal(await newer.save(), false);
    if (succeeds) gate.resolve();
    else gate.reject(new Error("disk full"));
    assert.equal(await pending, false);
    assert.equal(store.raw()?.label, succeeds ? "Departed" : "Saved");
    assert.deepEqual(newer.getSnapshot(), {
      draft: succeeds ? "Departed" : "Saved",
      error: null,
      busy: false,
      saving: false,
      saved: false,
      load: store.document.getSnapshot().state,
    });
    edit.start();
    assert.equal(edit.getSnapshot().draft, "Departed");
    assert.equal(edit.getSnapshot().error, null);
    assert.equal(edit.getSnapshot().saved, false);
    assert.equal(edit.getSnapshot().busy, false);
  });
}

test("a restarted edit is available as soon as its departed write settles", async () => {
  const store = await ready();
  const edit = started(store);
  edit.change("Departed");
  const gate = store.holdWrite();
  const pending = edit.save();
  edit.stop();
  edit.start();
  let resumed: boolean | null = null;
  store.document.subscribe(() => {
    if (resumed === null && !store.document.getSnapshot().saving) resumed = edit.change("Resumed");
  });
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(resumed, true);
  assert.equal(edit.getSnapshot().draft, "Resumed");
});

test("an observer can detach the edit during save publication without stale feedback", async () => {
  const store = await ready();
  const edit = started(store);
  edit.change("Accepted");
  let detached = false;
  store.document.subscribe(() => {
    if (detached || !store.document.getSnapshot().saving) return;
    detached = true;
    edit.stop();
    edit.start();
  });
  assert.equal(await edit.save(), false);
  assert.equal(store.raw()?.label, "Accepted");
  assert.equal(edit.getSnapshot().draft, "Accepted");
  assert.equal(edit.getSnapshot().busy, false);
  assert.equal(edit.getSnapshot().saved, false);
  edit.change("Resumed");
  assert.equal(await edit.save(), true);
});

test("a successful save confirms until the next change; a following draft follows again", async () => {
  const store = await ready();
  const edit = started(store, { follow: true });
  const filled = started(store);
  filled.change("  Entered  ");
  edit.change(" Next ");
  assert.equal(await edit.save(), true);
  assert.deepEqual(edit.getSnapshot(), {
    draft: "Next",
    error: null,
    busy: false,
    saving: false,
    saved: true,
    load: store.document.getSnapshot().state,
  });
  assert.equal(filled.getSnapshot().saved, false);
  await store.replace(encode("Remote"));
  assert.equal(edit.getSnapshot().draft, "Remote");
  edit.change("Changed");
  assert.equal(edit.getSnapshot().saved, false);
  // A filled draft keeps the text that was saved.
  assert.equal(await filled.save(), true);
  assert.equal(filled.getSnapshot().draft, "  Entered  ");
  assert.equal(filled.getSnapshot().saved, true);
});

test("load failure blocks saves and the edit's retry restores the saved document", async () => {
  const store = memory("broken");
  store.document.start();
  const edit = started(store);
  await flush();
  assert.equal(edit.getSnapshot().load.kind, "error");
  edit.change("Unsaved");
  assert.equal(await edit.save(), false);
  assert.ok(!store.calls.includes("write"));
  await store.storage.setItem(key, encode("Repaired"));
  edit.retryLoad();
  await flush();
  assert.equal(edit.getSnapshot().load.kind, "ready");
  assert.equal(edit.getSnapshot().draft, "Unsaved");
  assert.equal(edit.cancel(), true);
  assert.equal(edit.getSnapshot().draft, "Repaired");
});

test("a background refresh holds the edit busy without reporting a save", async () => {
  const store = await ready();
  const edit = started(store, { follow: true });
  edit.change("Confirmed");
  assert.equal(await edit.save(), true);
  const read = store.holdRead();
  const refresh = store.replace(encode("Remote"));
  assert.equal(edit.getSnapshot().busy, true);
  assert.equal(edit.getSnapshot().saving, false);
  assert.equal(edit.getSnapshot().saved, false);
  assert.equal(edit.change("Blocked"), false);
  read.resolve();
  await refresh;
  await flush();
  assert.equal(edit.getSnapshot().busy, false);
  assert.equal(edit.getSnapshot().draft, "Remote");
});
