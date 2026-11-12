import { applyPatches, enablePatches, type Patch, produceWithPatches } from 'immer';
import type { Command } from './commands';
import type { TimelineDoc } from './types';

enablePatches();

export type HistoryEntry = { label: string; patches: Patch[]; inverse: Patch[] };

/**
 * Undo/redo over immer patches (editor-performance: document state changes only through commands). `run`
 * applies a command atomically: if it throws, nothing changes. Each entry's `patches` are what autosave sends.
 */
export class History<D extends TimelineDoc = TimelineDoc> {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  constructor(
    private current: D,
    private readonly limit = 500,
  ) {}

  get doc(): D {
    return this.current;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  run(cmd: Command): HistoryEntry {
    const [next, patches, inverse] = produceWithPatches(this.current, (draft) => {
      cmd.apply(draft as unknown as TimelineDoc);
    });
    const entry = { label: cmd.label, patches, inverse };
    if (patches.length === 0) return entry;
    this.current = next as D;
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return entry;
  }

  undo(): HistoryEntry | undefined {
    const entry = this.past.pop();
    if (!entry) return undefined;
    this.current = applyPatches(this.current, entry.inverse);
    this.future.push(entry);
    return entry;
  }

  redo(): HistoryEntry | undefined {
    const entry = this.future.pop();
    if (!entry) return undefined;
    this.current = applyPatches(this.current, entry.patches);
    this.past.push(entry);
    return entry;
  }
}
