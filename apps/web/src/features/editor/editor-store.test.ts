import { setText, type TimelineDoc } from '@myvideo/timeline-core';
import { describe, expect, it, vi } from 'vitest';
import { createEditorStore, type SaveResult } from './editor-store';

// a tiny real-shaped project: one text element (the hook of an S01a clip)
const doc = (content: string, version = 1) =>
  ({
    fps: { num: 30, den: 1 },
    durationFrames: 300,
    tracks: [{ id: 't', kind: 'overlay', elementIds: ['h'] }],
    elements: {
      h: {
        type: 'text',
        id: 'h',
        trackId: 't',
        startFrame: 0,
        durationFrames: 90,
        origin: 'ai',
        content,
        transform: { x: 0, y: -520, scale: 1, rotation: 0 },
      },
    },
    _v: version,
  }) as unknown as TimelineDoc;
const textOf = (d: TimelineDoc) => (d.elements.h as { content: string }).content;

function setup(save: (doc: TimelineDoc, base: number) => Promise<SaveResult>, fetchLatest = vi.fn()) {
  vi.useFakeTimers();
  const store = createEditorStore({
    doc: doc('แคปแล้วบอกไซส์เสีย'),
    version: 3,
    save,
    fetchLatest,
    debounceMs: 1500,
  });
  return store;
}

describe('editor store', () => {
  it('runs commands, undoes and redoes, and tells listeners which elements changed', () => {
    const store = setup(async () => ({ ok: true, version: 4 }));
    const changed: string[][] = [];
    store.subscribe((ids) => changed.push(ids));
    store.run(setText('h', 'ส่งของวันพฤหัสนะคะ'));
    expect(textOf(store.doc())).toBe('ส่งของวันพฤหัสนะคะ');
    expect(changed.at(-1)).toEqual(['h']);
    store.undo();
    expect(textOf(store.doc())).toBe('แคปแล้วบอกไซส์เสีย');
    store.redo();
    expect(textOf(store.doc())).toBe('ส่งของวันพฤหัสนะคะ');
    vi.useRealTimers();
  });

  it('autosaves once, debounced after the last command, with the base version; status follows', async () => {
    const save = vi.fn(async (_d: TimelineDoc, base: number) => ({ ok: true as const, version: base + 1 }));
    const store = setup(save);
    store.run(setText('h', 'ก'));
    store.run(setText('h', 'กข'));
    expect(store.status()).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[1]).toBe(3);
    expect(textOf(save.mock.calls[0]?.[0] as TimelineDoc)).toBe('กข');
    expect(store.status()).toBe('saved');
    expect(store.version()).toBe(4);
    vi.useRealTimers();
  });

  it('a version conflict reloads the newer version and re-applies the unsaved edits on top', async () => {
    const save = vi
      .fn<(d: TimelineDoc, base: number) => Promise<SaveResult>>()
      .mockResolvedValueOnce({ ok: false, conflict: true })
      .mockImplementation(async (_d, base) => ({ ok: true, version: base + 1 }));
    // someone else saved version 4 with a new hook text and a moved element
    const theirs = doc('ข้อความจากอีกแท็บ');
    (theirs.elements.h as { startFrame: number }).startFrame = 30;
    const fetchLatest = vi.fn(async () => ({ doc: theirs, version: 4 }));
    const store = setup(save, fetchLatest);
    store.run(setText('h', 'ของฉัน'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchLatest).toHaveBeenCalledTimes(1);
    // my edit wins on top of their version, and their other change is kept
    const saved = save.mock.calls[1]?.[0] as TimelineDoc;
    expect(save.mock.calls[1]?.[1]).toBe(4);
    expect(textOf(saved)).toBe('ของฉัน');
    expect((saved.elements.h as { startFrame: number }).startFrame).toBe(30);
    expect(store.status()).toBe('saved');
    expect(store.version()).toBe(5);
    vi.useRealTimers();
  });

  it('a failed save keeps the edits and can be retried', async () => {
    const save = vi
      .fn<(d: TimelineDoc, base: number) => Promise<SaveResult>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async (_d, base) => ({ ok: true, version: base + 1 }));
    const store = setup(save);
    store.run(setText('h', 'ไม่หาย'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(store.status()).toBe('error');
    expect(textOf(store.doc())).toBe('ไม่หาย');
    await store.retry();
    expect(store.status()).toBe('saved');
    expect(textOf(save.mock.calls[1]?.[0] as TimelineDoc)).toBe('ไม่หาย');
    vi.useRealTimers();
  });
});
