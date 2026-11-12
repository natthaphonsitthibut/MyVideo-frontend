import { describe, expect, it } from 'vitest';
import {
  addElement,
  type Command,
  CommandError,
  deleteElement,
  moveElement,
  setCaptionWords,
  setText,
  setTransform,
  split,
  trimEnd,
  trimStart,
} from './commands';
import { History } from './history';
import type { TimelineDoc, TimelineElement } from './types';

const T = { V: 'tv', C: 'tc', O: 'to' };
const tf = { x: 0, y: 0, scale: 1, rotation: 0 };

function doc(): TimelineDoc {
  return {
    fps: { num: 30, den: 1 },
    durationFrames: 300,
    tracks: [
      { id: T.V, kind: 'video', elementIds: ['v1', 'v2'] },
      { id: T.C, kind: 'caption', elementIds: ['c1'] },
      { id: T.O, kind: 'overlay', elementIds: ['x1'] },
    ],
    elements: {
      v1: {
        type: 'video',
        id: 'v1',
        trackId: T.V,
        startFrame: 0,
        durationFrames: 100,
        origin: 'ai',
        assetId: 'a',
        sourceInFrame: 1000,
        playbackRate: 1,
        volume: 1,
        transform: tf,
        fit: 'cover',
      },
      v2: {
        type: 'video',
        id: 'v2',
        trackId: T.V,
        startFrame: 150,
        durationFrames: 100,
        origin: 'ai',
        assetId: 'a',
        sourceInFrame: 5000,
        playbackRate: 2,
        volume: 1,
        transform: tf,
        fit: 'cover',
      },
      c1: {
        type: 'caption',
        id: 'c1',
        trackId: T.C,
        startFrame: 0,
        durationFrames: 90,
        origin: 'ai',
        // real words (S01 transcript): "อบ 21.5 ยา 28.5 นะ"
        words: [
          { text: 'อบ', startFrame: 0, endFrame: 15 },
          { text: '21.5', startFrame: 15, endFrame: 35 },
          { text: 'ยา', startFrame: 35, endFrame: 50 },
          { text: '28.5', startFrame: 50, endFrame: 70 },
          { text: 'นะ', startFrame: 70, endFrame: 85 },
        ],
        lines: [
          [0, 1, 2],
          [3, 4],
        ],
        styleRef: 'bold-highlight',
        transform: tf,
      },
      x1: {
        type: 'text',
        id: 'x1',
        trackId: T.O,
        startFrame: 10,
        durationFrames: 50,
        origin: 'user',
        content: 'เสื้อมัดย้อม',
        transform: tf,
        styleRef: 'title',
      },
    },
  };
}

/** No two elements of a track overlap, all within the project, every element listed by exactly its track. */
function assertInvariants(d: TimelineDoc) {
  for (const t of d.tracks) {
    const els = t.elementIds.map((id) => d.elements[id] as TimelineElement);
    for (const e of els) {
      expect(e.trackId).toBe(t.id);
      expect(e.startFrame).toBeGreaterThanOrEqual(0);
      expect(e.durationFrames).toBeGreaterThanOrEqual(1);
      expect(e.startFrame + e.durationFrames).toBeLessThanOrEqual(d.durationFrames);
    }
    const sorted = [...els].sort((a, b) => a.startFrame - b.startFrame);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1] as TimelineElement;
      const b = sorted[i] as TimelineElement;
      expect(b.startFrame).toBeGreaterThanOrEqual(a.startFrame + a.durationFrames);
    }
  }
  const listed = d.tracks.flatMap((t) => t.elementIds);
  expect(new Set(listed).size).toBe(listed.length);
  expect(listed.sort()).toEqual(Object.keys(d.elements).sort());
}

const commands: [string, Command, (after: TimelineDoc) => void][] = [
  [
    'addElement',
    addElement({
      type: 'text',
      id: 'x2',
      trackId: T.O,
      startFrame: 100,
      durationFrames: 30,
      origin: 'user',
      content: 'ราคา 150 บาท',
      transform: tf,
      styleRef: 'title',
    }),
    (a) => expect(a.tracks[2]?.elementIds).toEqual(['x1', 'x2']),
  ],
  ['moveElement', moveElement('v2', { startFrame: 180 }), (a) => expect(a.elements.v2?.startFrame).toBe(180)],
  [
    'moveElement to another track',
    moveElement('v2', { startFrame: 100, trackId: T.O }),
    (a) => {
      expect(a.elements.v2?.trackId).toBe(T.O);
      expect(a.tracks[2]?.elementIds).toEqual(['x1', 'v2']);
      expect(a.tracks[0]?.elementIds).toEqual(['v1']);
    },
  ],
  [
    'trimStart (media keeps its content in place)',
    trimStart('v2', 160),
    (a) => {
      const v = a.elements.v2 as Extract<TimelineElement, { type: 'video' }>;
      expect(v).toMatchObject({ startFrame: 160, durationFrames: 90, sourceInFrame: 5020 }); // 10 frames × rate 2
    },
  ],
  [
    'trimStart (caption words shift, words cut off are dropped)',
    trimStart('c1', 20),
    (a) => {
      const c = a.elements.c1 as Extract<TimelineElement, { type: 'caption' }>;
      expect(c.startFrame).toBe(20);
      expect(c.words.map((w) => [w.text, w.startFrame, w.endFrame])).toEqual([
        ['21.5', 0, 15],
        ['ยา', 15, 30],
        ['28.5', 30, 50],
        ['นะ', 50, 65],
      ]);
      expect(c.lines).toEqual([
        [0, 1],
        [2, 3],
      ]);
    },
  ],
  ['trimEnd', trimEnd('v1', 80), (a) => expect(a.elements.v1?.durationFrames).toBe(80)],
  [
    'split',
    split('v1', 40, 'v1b'),
    (a) => {
      expect(a.elements.v1).toMatchObject({ startFrame: 0, durationFrames: 40, sourceInFrame: 1000 });
      expect(a.elements.v1b).toMatchObject({
        id: 'v1b',
        startFrame: 40,
        durationFrames: 60,
        sourceInFrame: 1040,
      });
      expect(a.tracks[0]?.elementIds).toEqual(['v1', 'v1b', 'v2']);
    },
  ],
  [
    'split a caption between words',
    split('c1', 50, 'c1b'),
    (a) => {
      const l = a.elements.c1 as Extract<TimelineElement, { type: 'caption' }>;
      const r = a.elements.c1b as Extract<TimelineElement, { type: 'caption' }>;
      expect(l.words.map((w) => w.text)).toEqual(['อบ', '21.5', 'ยา']);
      expect(r.words.map((w) => [w.text, w.startFrame])).toEqual([
        ['28.5', 0],
        ['นะ', 20],
      ]);
    },
  ],
  ['delete', deleteElement('x1'), (a) => expect(a.elements.x1).toBeUndefined()],
  ['setText', setText('x1', 'ลด 20%'), (a) => expect(a.elements.x1).toMatchObject({ content: 'ลด 20%' })],
  [
    'setTransform',
    setTransform('x1', { x: 10, y: -500, scale: 1.2, rotation: 0 }),
    (a) => expect(a.elements.x1).toMatchObject({ transform: { y: -500, scale: 1.2 } }),
  ],
  [
    'setCaptionWords',
    setCaptionWords('c1', [{ text: '21.5 นิ้ว', startFrame: 0, endFrame: 40 }], [[0]]),
    (a) => expect(a.elements.c1).toMatchObject({ words: [{ text: '21.5 นิ้ว' }], lines: [[0]] }),
  ],
];

describe('commands: do → undo → redo', () => {
  it.each(commands)('%s', (_n, cmd, check) => {
    const h = new History(doc());
    h.run(cmd);
    const after = h.doc;
    check(after);
    assertInvariants(after);
    h.undo();
    expect(h.doc).toEqual(doc());
    h.redo();
    expect(h.doc).toEqual(after);
  });
});

describe('commands refuse invalid edits and leave the document unchanged', () => {
  const bad: [string, Command, RegExp][] = [
    ['move onto a neighbour', moveElement('v2', { startFrame: 50 }), /overlap/],
    ['move past the end', moveElement('v2', { startFrame: 250 }), /end of the project/],
    ['trim to nothing', trimEnd('v1', 0), /at least 1 frame/],
    ['trimStart before the media starts', trimStart('v1', -1), /before frame 0|source/],
    ['split outside the element', split('v1', 100, 'z'), /inside/],
    [
      'caption on a video track',
      moveElement('c1', { startFrame: 260, trackId: T.V }),
      /cannot sit on a video track/,
    ],
    ['unknown element', deleteElement('nope'), /not found/],
    ['setText on a video', setText('v1', 'x'), /text element/],
    ['locked element', moveElement('v1', { startFrame: 110 }), /locked/],
  ];
  it.each(bad)('%s', (_n, cmd, msg) => {
    const start = doc();
    (start.elements.v1 as TimelineElement).locked = _n === 'locked element' ? true : undefined;
    if (_n !== 'locked element') delete (start.elements.v1 as TimelineElement).locked;
    const h = new History(start);
    expect(() => h.run(cmd)).toThrow(CommandError);
    expect(() => h.run(cmd)).toThrow(msg);
    expect(h.doc).toEqual(start);
    expect(h.canUndo).toBe(false);
  });
});

describe('history limit', () => {
  it('keeps only the newest N steps; a new command clears redo', () => {
    const h = new History(doc(), 2);
    h.run(setText('x1', 'a'));
    h.run(setText('x1', 'b'));
    h.run(setText('x1', 'c'));
    h.undo();
    h.undo();
    expect(h.canUndo).toBe(false);
    expect(h.doc.elements.x1).toMatchObject({ content: 'a' });
    h.run(setText('x1', 'z'));
    expect(h.canRedo).toBe(false);
  });
});

describe('random edit sequences', () => {
  it('never break the invariants; undoing everything restores the original exactly', () => {
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const h = new History(doc(), 10_000);
    let applied = 0;
    for (let i = 0; i < 2000; i++) {
      const ids = Object.keys(h.doc.elements);
      const id = ids[Math.floor(rnd() * ids.length)] ?? 'v1';
      const f = Math.floor(rnd() * 320) - 10;
      const pick = Math.floor(rnd() * 6);
      const cmd: Command =
        pick === 0
          ? moveElement(id, { startFrame: f })
          : pick === 1
            ? trimStart(id, f)
            : pick === 2
              ? trimEnd(id, f)
              : pick === 3
                ? split(id, f, `s${i}`)
                : pick === 4
                  ? setTransform(id, { x: f, y: 0, scale: 1, rotation: 0 })
                  : addElement({
                      type: 'text',
                      id: `n${i}`,
                      trackId: T.O,
                      startFrame: Math.max(0, f),
                      durationFrames: 1 + Math.floor(rnd() * 40),
                      origin: 'user',
                      content: 'x',
                      transform: tf,
                      styleRef: 'title',
                    });
      try {
        h.run(cmd);
        applied++;
      } catch (e) {
        if (!(e instanceof CommandError)) throw e;
      }
      assertInvariants(h.doc);
    }
    expect(applied).toBeGreaterThan(300);
    while (h.canUndo) h.undo();
    expect(h.doc).toEqual(doc());
  });
});
