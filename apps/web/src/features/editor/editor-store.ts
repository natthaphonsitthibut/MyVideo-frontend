import { type Command, History, type TimelineDoc } from '@myvideo/timeline-core';

/**
 * Document state of the Quick Edit screen (editor-performance: document changes only through commands; React reads
 * small slices via `subscribe`). Every command is undoable and schedules a debounced autosave with the version it
 * was made on. On a version conflict (another tab/device saved first) the newer version is loaded and the commands
 * not yet saved are applied again on top of it — the merchant's edits are never lost and the other save is kept.
 */
/** An immer patch (shape only; the web app does not depend on immer directly). */
type Patch = { op: 'add' | 'remove' | 'replace'; path: (string | number)[]; value?: unknown };

export type SaveResult = { ok: true; version: number } | { ok: false; conflict: true };
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export type EditorStore = ReturnType<typeof createEditorStore>;

export function createEditorStore<D extends TimelineDoc>(opts: {
  doc: D;
  version: number;
  save: (doc: D, baseVersion: number) => Promise<SaveResult>;
  fetchLatest: () => Promise<{ doc: D; version: number }>;
  debounceMs?: number;
}) {
  let history = new History<D>(opts.doc);
  let version = opts.version;
  let status: SaveStatus = 'saved';
  // commands applied since the last successful save (replayed on a conflict)
  let unsaved: Command[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  const docListeners = new Set<(changed: string[]) => void>();
  const statusListeners = new Set<() => void>();

  const setStatus = (s: SaveStatus) => {
    status = s;
    for (const l of statusListeners) l();
  };
  const changedIds = (patches: { path: (string | number)[] }[]) => [
    ...new Set(
      patches
        .filter((p) => p.path[0] === 'elements' && p.path[1] !== undefined)
        .map((p) => String(p.path[1])),
    ),
  ];
  const emit = (ids: string[]) => {
    for (const l of docListeners) l(ids);
  };
  const schedule = () => {
    setStatus('dirty');
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), opts.debounceMs ?? 1500);
  };

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (inFlight) return inFlight;
    if (unsaved.length === 0) {
      setStatus('saved');
      return;
    }
    const sending = unsaved.length;
    inFlight = (async () => {
      setStatus('saving');
      try {
        let r = await opts.save(history.doc, version);
        if (!r.ok) {
          // rebase: newest server version + every command not saved yet, then save again
          const latest = await opts.fetchLatest();
          const pending = unsaved;
          history = new History<D>(latest.doc);
          version = latest.version;
          for (const cmd of pending) {
            try {
              history.run(cmd);
            } catch {
              // a command that no longer applies (its element was removed elsewhere) is dropped
            }
          }
          emit(Object.keys(history.doc.elements));
          r = await opts.save(history.doc, version);
          if (!r.ok) throw new Error('version conflict again');
        }
        version = r.version;
        unsaved = unsaved.slice(sending);
        setStatus(unsaved.length ? 'dirty' : 'saved');
        if (unsaved.length) schedule();
      } catch {
        setStatus('error');
      } finally {
        inFlight = undefined;
      }
    })();
    return inFlight;
  }

  return {
    doc: () => history.doc,
    version: () => version,
    status: () => status,
    canUndo: () => history.canUndo,
    canRedo: () => history.canRedo,
    run(cmd: Command) {
      const entry = history.run(cmd);
      if (entry.patches.length === 0) return;
      unsaved.push(cmd);
      emit(changedIds(entry.patches));
      schedule();
    },
    undo() {
      const entry = history.undo();
      if (!entry) return;
      // the undone state is what gets saved; the replay list gets the inverse as one command
      unsaved = rebuildUnsaved(unsaved, entry, 'undo');
      emit(changedIds(entry.inverse));
      schedule();
    },
    redo() {
      const entry = history.redo();
      if (!entry) return;
      unsaved = rebuildUnsaved(unsaved, entry, 'redo');
      emit(changedIds(entry.patches));
      schedule();
    },
    /** Save now (retry after an error, or before leaving the page). */
    retry: () => flush(),
    flush: () => flush(),
    subscribe(l: (changed: string[]) => void) {
      docListeners.add(l);
      return () => {
        docListeners.delete(l);
      };
    },
    subscribeStatus(l: () => void) {
      statusListeners.add(l);
      return () => {
        statusListeners.delete(l);
      };
    },
    dispose() {
      clearTimeout(timer);
      docListeners.clear();
      statusListeners.clear();
    },
  };
}

/**
 * Undo/redo after edits were saved: the replay list must reproduce the current document from the last saved one.
 * Undo/redo are expressed as patch-applying commands so a rebase replays them like any other edit.
 */
function rebuildUnsaved(
  list: Command[],
  entry: { label: string; patches: unknown[]; inverse: unknown[] },
  kind: 'undo' | 'redo',
): Command[] {
  const patches = (kind === 'undo' ? entry.inverse : entry.patches) as Patch[];
  return [
    ...list,
    {
      label: `${kind} ${entry.label}`,
      apply: (draft) => {
        applyPatchesInPlace(draft, patches);
      },
    },
  ];
}

function applyPatchesInPlace(draft: unknown, patches: Patch[]) {
  for (const p of patches) {
    let target = draft as Record<string | number, unknown>;
    for (let i = 0; i < p.path.length - 1; i++)
      target = target[p.path[i] as string] as Record<string, unknown>;
    const key = p.path[p.path.length - 1] as string;
    if (p.op === 'remove') {
      if (Array.isArray(target)) target.splice(Number(key), 1);
      else delete target[key];
    } else if (p.op === 'add' && Array.isArray(target)) target.splice(Number(key), 0, p.value);
    else target[key] = p.value;
  }
}
