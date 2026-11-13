import { expect, it } from 'vitest';
import { gapAfter, wordMarking } from './word-marking';

it('Thai words read joined; a gap stays next to numbers/Latin and around a removed word', () => {
  // real L02 line: "ผมจะเปิดรอบสอง" was shown as เปิด รอบ สอง
  const line = ['ผม', 'จะ', 'เปิด', 'รอบ', 'สอง', '7998', 'บาท'].map((text) => ({ text }));
  expect(line.map((_, i) => gapAfter(line, i))).toEqual([false, false, false, false, true, true, false]);
  const removed = [{ text: 'จา' }, { text: '', deleted: true }, { text: 'บริษัท' }];
  expect(gapAfter(removed, 0)).toBe(true);
  // a hidden AI-merged word is skipped when looking at the next word
  const merged = [{ text: 'ห่อหมก' }, { text: '', mergedInto: 0 }, { text: 'ครับ' }];
  expect(gapAfter(merged, 0)).toBe(false);
});

it('marks AI words and keeps heard text available for revert', () => {
  expect(wordMarking({ original: null, aiFixed: true, heard: 'พิม' })).toEqual({
    ai: true,
    edited: false,
    heard: 'พิม',
    title: 'AI แก้จาก “พิม”',
    canRevert: true,
  });
});
it('merchant edits win; untouched and older words have no AI mark', () => {
  expect(wordMarking({ original: 'พิม', aiFixed: false, heard: 'พิม' })).toMatchObject({
    ai: false,
    edited: true,
    canRevert: true,
  });
  expect(wordMarking({ original: null })).toMatchObject({ ai: false, edited: false, canRevert: false });
  expect(wordMarking({ original: null, aiFixed: false, heard: null }).title).toBeUndefined();
});
